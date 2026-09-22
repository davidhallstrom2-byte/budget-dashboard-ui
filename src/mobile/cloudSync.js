const MOBILE_API_ENDPOINT = "/budget-dashboard-fs/mobile-api.php";
const META_STORAGE_KEY = "budgetMobileSync.keyMeta.v1";
const FORCE_PUSH_STORAGE_KEY = "budgetMobileSync.forcePush.v1";
const POLL_INTERVAL_MS = 1500;
const PULL_INTERVAL_MS = 5 * 60 * 1000;
const UPLOAD_PAUSE_KEY = "budgetMobileSync.uploadPause.v2";
const BATCH_TARGET_BYTES = 256 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_VALUE_BYTES = 8 * 1024 * 1024;
const byteLength = (text) => new TextEncoder().encode(text).length;

// Navigate the document first; API cookies always remain same-origin.
const ensureCanonicalHost = () => {
  const url = new URL(window.location.href);
  if (["businesswebcreations.com", "www.businesswebcreations.com"].includes(url.hostname.toLowerCase()) &&
      (url.hostname !== "www.businesswebcreations.com" || url.protocol !== "https:" || url.port)) {
    url.protocol = "https:";
    url.hostname = "www.businesswebcreations.com";
    url.port = "";
    window.location.replace(url.href);
    throw new Error("Opening the secure www dashboard before connecting...");
  }
};

let csrfToken = "";
let activeController = null;
let syncStatus = { state: "idle", message: "Not connected", lastSyncedAt: "" };
const statusListeners = new Set();

const updateStatus = (next) => {
  syncStatus = { ...syncStatus, ...next };
  statusListeners.forEach((listener) => {
    try {
      listener(syncStatus);
    } catch {
      // Status display failures must never interrupt synchronization.
    }
  });
};

const readJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const isSyncableKey = (key) => {
  const value = String(key || "");
  if (!value || value === META_STORAGE_KEY) return false;
  if (value.startsWith("budgetMobileSync.")) return false;
  if (value.startsWith("googleCalendar.")) return false;
  if (/(?:accessToken|tokenExpiresAt|openLinked|returnContext|createDraft)/i.test(value)) return false;
  return true;
};

const collectLocalItems = () => {
  const items = Object.create(null);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!isSyncableKey(key)) continue;
    items[key] = window.localStorage.getItem(key);
  }
  return items;
};

const readKeyMeta = () => {
  const parsed = readJson(window.localStorage.getItem(META_STORAGE_KEY) || "{}", {});
  return Object.assign(Object.create(null), parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
};

const writeKeyMeta = (meta) => {
  window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
};

const mobileRequest = async (action, options = {}) => {
  ensureCanonicalHost();
  const { query = {}, signal, ...requestOptions } = options;
  const params = new URLSearchParams({ action, ...query });
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (signal?.aborted) abort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(cancel, 30000);
  try {
    const response = await fetch(`${MOBILE_API_ENDPOINT}?${params}`, {
      ...requestOptions,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: abort.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `Mobile request failed with status ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    if (abort.signal.aborted) throw new Error("Mobile request was cancelled.");
    if (payload.csrfToken) csrfToken = payload.csrfToken;
    return payload;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
};

export const isLocalDevelopmentHost = () => {
  if (typeof window === "undefined") return false;
  const hostname = String(window.location.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
};

export const getMobileStatus = async () => {
  const payload = await mobileRequest("status");
  if (payload.csrfToken) csrfToken = payload.csrfToken;
  return payload;
};

export const setupMobileAccess = async ({ setupKey, email, password }) => {
  return mobileRequest("setup", {
    method: "POST",
    body: JSON.stringify({ setupKey, email, password }),
  });
};

export const loginMobileAccess = async ({ email, password }) => {
  return mobileRequest("login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const logoutMobileAccess = async () => {
  const result = await mobileRequest("logout", { method: "POST", body: JSON.stringify({}) });
  csrfToken = "";
  return result;
};

const applyRemoteItems = (remoteItems, meta, baseline) => {
  let changed = false;
  Object.entries(remoteItems || {}).forEach(([key, remote]) => {
    if (!isSyncableKey(key) || !remote || typeof remote !== "object") return;
    const remoteTime = Number(remote.updatedAt || 0);
    const localTime = Number(meta[key] || 0);
    if (remoteTime < localTime) return;

    if (remote.value === null) {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        changed = true;
      }
      delete baseline[key];
    } else if (typeof remote.value === "string" && window.localStorage.getItem(key) !== remote.value) {
      window.localStorage.setItem(key, remote.value);
      baseline[key] = remote.value;
      changed = true;
    }

    meta[key] = remoteTime;
  });
  writeKeyMeta(meta);
  return changed;
};

const createController = () => {
  let stopped = false;
  let ready = false;
  let pollTimer = null;
  let pullTimer = null;
  let pushTimer = null;
  let busy = false;
  let pullRequested = false;
  let revision = 0;
  let baseline = collectLocalItems();
  let keyMeta = readKeyMeta();
  let pendingChanges = Object.create(null);
  let uploadPaused = Boolean(window.localStorage.getItem(UPLOAD_PAUSE_KEY));
  let pullNotBefore = 0;
  let lastReturnPull = -Infinity;
  const abort = new AbortController();
  const request = (action, options = {}) => mobileRequest(action, { ...options, signal: abort.signal });
  const validate = (payload) => {
    if (payload.protocol !== 2 || !Number.isSafeInteger(payload.revision) || payload.revision < 0 ||
        !payload.items || typeof payload.items !== "object" || Array.isArray(payload.items)) {
      throw new Error("Cloud sync needs the matching version 2 mobile-api.php. Uploads remain stopped.");
    }
  };
  const showCurrentStatus = () => {
    if (stopped) return;
    updateStatus(uploadPaused
      ? { state: "error", message: "Cloud uploads paused after an interrupted or failed save. Local data is retained; an explicit sync retry is required." }
      : Object.keys(pendingChanges).length
        ? { state: "syncing", message: "Local changes waiting to upload..." }
        : { state: "synced", message: "Cloud sync current", lastSyncedAt: new Date().toISOString() });
  };
  const queuePush = () => {
    if (stopped || !ready || uploadPaused || pushTimer || !Object.keys(pendingChanges).length) return;
    pushTimer = window.setTimeout(() => {
      pushTimer = null;
      void pushPending();
    }, 1000);
  };
  const detectLocalChanges = () => {
    if (stopped) return;
    const current = collectLocalItems();
    const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
    let foundChange = false;
    keys.forEach((key) => {
      const previousValue = Object.prototype.hasOwnProperty.call(baseline, key) ? baseline[key] : null;
      const currentValue = Object.prototype.hasOwnProperty.call(current, key) ? current[key] : null;
      if (previousValue === currentValue) return;
      const updatedAt = Math.max(Date.now(), Number(keyMeta[key] || 0) + 1);
      keyMeta[key] = updatedAt;
      pendingChanges[key] = { value: currentValue, updatedAt };
      foundChange = true;
    });
    baseline = current;
    if (foundChange) {
      writeKeyMeta(keyMeta);
      queuePush();
    }
  };
  const applyPayload = (payload, sent = null) => {
    // Capture edits made while fetch was in flight before applying remote values.
    detectLocalChanges();
    const incoming = { ...payload.items };
    for (const [key, time] of Object.entries(payload.accepted || {})) {
      if (sent && Object.prototype.hasOwnProperty.call(sent, key) && !pendingChanges[key]) {
        keyMeta[key] = Number(time);
      }
    }
    for (const key of Object.keys(incoming)) {
      // Reconcile a lost acknowledgement without uploading an already committed value again.
      const pending = pendingChanges[key];
      if (pending && incoming[key]?.value === pending.value && Number(incoming[key].updatedAt) >= pending.updatedAt) {
        delete pendingChanges[key];
      } else if (pending) {
        // Other unsent edits survive until the next upload resolves them against the server.
        delete incoming[key];
      }
    }
    const changed = applyRemoteItems(incoming, keyMeta, baseline);
    keyMeta = readKeyMeta();
    revision = payload.revision;
    if (changed) {
      baseline = collectLocalItems();
      window.dispatchEvent(new CustomEvent("budgetMobileSyncApplied"));
    }
  };
  const pauseUploads = (message) => {
    uploadPaused = true;
    try { window.localStorage.setItem(UPLOAD_PAUSE_KEY, JSON.stringify({ at: Date.now(), message })); } catch { /* Already paused in memory. */ }
    if (!stopped) updateStatus({ state: "error", message: `${message} Cloud uploads paused; local data is retained. Retry explicitly after fixing the cause.` });
  };
  const pushPending = async () => {
    if (stopped || busy || uploadPaused || !Object.keys(pendingChanges).length) return;
    busy = true;
    const changes = Object.create(null);
    try {
      let size = 0;
      for (const [key, change] of Object.entries(pendingChanges)) {
        const entryBytes = byteLength(JSON.stringify({ [key]: change }));
        if (Object.keys(changes).length && (size + entryBytes > BATCH_TARGET_BYTES || Object.keys(changes).length >= 500)) break;
        if (byteLength(key) > 190 || byteLength(change.value || "") > MAX_VALUE_BYTES) {
          throw new Error(`Storage item "${key}" exceeds the server sync limit.`);
        }
        changes[key] = change;
        size += entryBytes;
      }
      const body = JSON.stringify({ protocol: 2, revision, changes });
      if (byteLength(body) > MAX_REQUEST_BYTES) throw new Error("The encoded storage item exceeds the server request limit.");
      // Persist BEFORE sending. A closed tab or lost response must not restart a large POST loop.
      window.localStorage.setItem(UPLOAD_PAUSE_KEY, JSON.stringify({ at: Date.now(), message: "Upload acknowledgement pending" }));
      for (const key of Object.keys(changes)) delete pendingChanges[key];
      updateStatus({ state: "syncing", message: "Saving changes..." });
      const payload = await request("sync", { method: "POST", body });
      if (stopped) return;
      validate(payload);
      if (!payload.accepted || typeof payload.accepted !== "object") throw new Error("Missing upload acknowledgement.");
      for (const key of Object.keys(changes)) {
        if (!Object.prototype.hasOwnProperty.call(payload.accepted, key) && !Object.prototype.hasOwnProperty.call(payload.items, key)) {
          throw new Error("Incomplete upload acknowledgement.");
        }
      }
      applyPayload(payload, changes);
      window.localStorage.removeItem(UPLOAD_PAUSE_KEY);
      if (!Object.keys(pendingChanges).length) window.localStorage.removeItem(FORCE_PUSH_STORAGE_KEY);
      showCurrentStatus();
    } catch (error) {
      if (stopped) return;
      pendingChanges = Object.assign(Object.create(null), changes, pendingChanges);
      pauseUploads(error?.message || "Cloud save failed.");
    } finally {
      busy = false;
      queuePush();
      if (pullRequested && !stopped) void pullRemote();
    }
  };
  const pullRemote = async () => {
    if (stopped || !ready) return;
    if (busy) { pullRequested = true; return; }
    if (Date.now() < pullNotBefore) { pullRequested = false; return; }
    pullRequested = false;
    busy = true;
    try {
      detectLocalChanges();
      const payload = await request("state", { query: { protocol: "2", since: String(revision) } });
      if (stopped) return;
      validate(payload);
      applyPayload(payload);
      showCurrentStatus();
    } catch (error) {
      // Focus events cannot turn a failing read into a tight retry loop.
      pullNotBefore = Date.now() + PULL_INTERVAL_MS;
      if (!stopped) updateStatus({ state: "error", message: error?.message || "Could not check cloud data." });
    } finally {
      busy = false;
      pullRequested = false;
      queuePush();
    }
  };
  const handleReturn = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastReturnPull < 1000) return;
    lastReturnPull = Date.now();
    void pullRemote();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") handleReturn();
    else detectLocalChanges();
  };
  const initialize = async () => {
    updateStatus({ state: "syncing", message: "Connecting to cloud data..." });
    const payload = await request("state", { query: { protocol: "2" } });
    if (stopped) return controller;
    validate(payload);
    detectLocalChanges();
    revision = payload.revision;
    const remoteItems = payload.items;
    const force = readJson(window.localStorage.getItem(FORCE_PUSH_STORAGE_KEY) || "null", null);
    if (force && typeof force === "object" && String(force.snapshotId || "").trim()) {
      let updatedAt = Date.now();
      for (const [key, value] of Object.entries(collectLocalItems())) {
        updatedAt = Math.max(updatedAt + 1, Number(keyMeta[key] || 0) + 1);
        keyMeta[key] = updatedAt;
        pendingChanges[key] = { value, updatedAt };
      }
    } else {
      applyPayload(payload);
      const local = collectLocalItems();
      // Include deletion tombstones remembered in keyMeta across restarts.
      for (const key of new Set([...Object.keys(local), ...Object.keys(keyMeta)])) {
        if (!isSyncableKey(key) || pendingChanges[key]) continue;
        const remote = remoteItems[key];
        const localTime = Number(keyMeta[key] || 0);
        const hasLocal = Object.prototype.hasOwnProperty.call(local, key);
        if ((!remote && hasLocal) || localTime > Number(remote?.updatedAt || 0)) {
          const updatedAt = localTime || Date.now();
          keyMeta[key] = updatedAt;
          pendingChanges[key] = { value: hasLocal ? local[key] : null, updatedAt };
        }
      }
    }
    writeKeyMeta(keyMeta);
    baseline = collectLocalItems();
    ready = true;
    if (!Object.keys(pendingChanges).length) window.localStorage.removeItem(FORCE_PUSH_STORAGE_KEY);
    await pushPending();
    if (stopped) return controller;
    showCurrentStatus();
    pollTimer = window.setInterval(detectLocalChanges, POLL_INTERVAL_MS);
    pullTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void pullRemote();
    }, PULL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleReturn);
    queuePush();
    return controller;
  };
  const controller = {
    initialize,
    // Explicit caller action only; timers/focus never clear the durable upload pause.
    syncNow: async () => {
      if (stopped || !ready || busy) return;
      uploadPaused = false;
      window.localStorage.removeItem(UPLOAD_PAUSE_KEY);
      pullNotBefore = 0;
      detectLocalChanges();
      await pullRemote();
      await pushPending();
    },
    stop: () => {
      stopped = true;
      abort.abort();
      if (pollTimer) window.clearInterval(pollTimer);
      if (pullTimer) window.clearInterval(pullTimer);
      if (pushTimer) window.clearTimeout(pushTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleReturn);
      updateStatus({ state: "idle", message: "Not connected" });
    },
  };
  return controller;
};

let startPromise = null;
export const startCloudSync = () => {
  if (activeController) return startPromise || Promise.resolve(activeController);
  const controller = createController();
  activeController = controller;
  startPromise = controller.initialize().catch((error) => {
    if (activeController === controller) {
      controller.stop();
      activeController = null;
      startPromise = null;
      updateStatus({ state: "error", message: error?.message || "Cloud sync could not start." });
    }
    throw error;
  });
  return startPromise;
};

export const stopCloudSync = () => {
  if (activeController) activeController.stop();
  activeController = null;
  startPromise = null;
};

export const subscribeCloudSyncStatus = (listener) => {
  statusListeners.add(listener);
  listener(syncStatus);
  return () => statusListeners.delete(listener);
};

export const exportMobileMigrationFile = () => {
  const payload = {
    type: "budget-dashboard-mobile-migration",
    version: 1,
    exportedAt: new Date().toISOString(),
    items: collectLocalItems(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `budget-dashboard-mobile-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const importMobileMigrationFile = async (file) => {
  if (!file) return 0;
  const text = await file.text();
  const payload = readJson(text, null);
  if (payload?.type !== "budget-dashboard-mobile-migration" || !payload.items || typeof payload.items !== "object") {
    throw new Error("This is not a valid Budget Dashboard mobile-data file.");
  }

  const meta = readKeyMeta();
  let imported = 0;
  let timestamp = Date.now();
  Object.entries(payload.items).forEach(([key, value]) => {
    if (!isSyncableKey(key) || typeof value !== "string") return;
    window.localStorage.setItem(key, value);
    timestamp += 1;
    meta[key] = timestamp;
    imported += 1;
  });
  writeKeyMeta(meta);
  return imported;
};
