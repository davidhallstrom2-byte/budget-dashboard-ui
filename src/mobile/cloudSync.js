const MOBILE_API_ENDPOINT = "/budget-dashboard-fs/mobile-api.php";
const META_STORAGE_KEY = "budgetMobileSync.keyMeta.v1";
const POLL_INTERVAL_MS = 1500;
const PULL_INTERVAL_MS = 10000;

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
  const items = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!isSyncableKey(key)) continue;
    items[key] = window.localStorage.getItem(key);
  }
  return items;
};

const readKeyMeta = () => {
  const parsed = readJson(window.localStorage.getItem(META_STORAGE_KEY) || "{}", {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const writeKeyMeta = (meta) => {
  window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
};

const mobileRequest = async (action, options = {}) => {
  const response = await fetch(`${MOBILE_API_ENDPOINT}?action=${encodeURIComponent(action)}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Mobile request failed with status ${response.status}.`);
  }
  if (payload.csrfToken) csrfToken = payload.csrfToken;
  return payload;
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
  let pollTimer = null;
  let pullTimer = null;
  let pushTimer = null;
  let pushing = false;
  let pulling = false;
  let revision = 0;
  let baseline = {};
  let keyMeta = readKeyMeta();
  let pendingChanges = {};

  const queuePush = () => {
    if (stopped || pushTimer) return;
    pushTimer = window.setTimeout(() => {
      pushTimer = null;
      pushPending();
    }, 500);
  };

  const pushPending = async () => {
    if (stopped || pushing || !Object.keys(pendingChanges).length) return;
    pushing = true;
    const changes = pendingChanges;
    pendingChanges = {};
    updateStatus({ state: "syncing", message: "Saving changes..." });

    try {
      const payload = await mobileRequest("sync", {
        method: "POST",
        body: JSON.stringify({ revision, changes }),
      });
      revision = Number(payload.revision || revision);
      updateStatus({
        state: "synced",
        message: "Cloud sync current",
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      pendingChanges = { ...changes, ...pendingChanges };
      updateStatus({ state: "error", message: error?.message || "Cloud sync failed." });
    } finally {
      pushing = false;
      if (Object.keys(pendingChanges).length) queuePush();
    }
  };

  const detectLocalChanges = () => {
    if (stopped) return;
    const current = collectLocalItems();
    const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
    let foundChange = false;

    keys.forEach((key) => {
      const previousValue = Object.prototype.hasOwnProperty.call(baseline, key) ? baseline[key] : null;
      const currentHasKey = Object.prototype.hasOwnProperty.call(current, key);
      const currentValue = currentHasKey ? current[key] : null;
      if (previousValue === currentValue) return;

      const updatedAt = Date.now();
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

  const pullRemote = async () => {
    if (stopped || pulling || pushing) return;
    pulling = true;
    try {
      const payload = await mobileRequest("state");
      revision = Number(payload.revision || revision);
      const changed = applyRemoteItems(payload.items || {}, keyMeta, baseline);
      keyMeta = readKeyMeta();
      if (changed) {
        baseline = collectLocalItems();
        window.dispatchEvent(new CustomEvent("budgetMobileSyncApplied"));
      }
      updateStatus({
        state: "synced",
        message: "Cloud sync current",
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      updateStatus({ state: "error", message: error?.message || "Could not check cloud data." });
    } finally {
      pulling = false;
    }
  };

  const initialize = async () => {
    updateStatus({ state: "syncing", message: "Connecting to cloud data..." });
    const payload = await mobileRequest("state");
    revision = Number(payload.revision || 0);
    const remoteItems = payload.items || {};
    const localItemsBefore = collectLocalItems();
    const remoteKeys = new Set(Object.keys(remoteItems));

    applyRemoteItems(remoteItems, keyMeta, localItemsBefore);
    keyMeta = readKeyMeta();
    const localItemsAfter = collectLocalItems();

    Object.entries(localItemsAfter).forEach(([key, value]) => {
      const remote = remoteItems[key];
      const localTime = Number(keyMeta[key] || 0);
      const remoteTime = Number(remote?.updatedAt || 0);
      if (!remoteKeys.has(key) || localTime > remoteTime) {
        const updatedAt = localTime || Date.now();
        keyMeta[key] = updatedAt;
        pendingChanges[key] = { value, updatedAt };
      }
    });

    writeKeyMeta(keyMeta);
    baseline = localItemsAfter;
    if (Object.keys(pendingChanges).length) await pushPending();

    updateStatus({
      state: "synced",
      message: "Cloud sync current",
      lastSyncedAt: new Date().toISOString(),
    });

    pollTimer = window.setInterval(detectLocalChanges, POLL_INTERVAL_MS);
    pullTimer = window.setInterval(pullRemote, PULL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", pullRemote);
    return controller;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") pullRemote();
    else detectLocalChanges();
  };

  const controller = {
    initialize,
    syncNow: async () => {
      detectLocalChanges();
      await pushPending();
      await pullRemote();
    },
    stop: () => {
      stopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (pullTimer) window.clearInterval(pullTimer);
      if (pushTimer) window.clearTimeout(pushTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", pullRemote);
      updateStatus({ state: "idle", message: "Not connected" });
    },
  };

  return controller;
};

export const startCloudSync = async () => {
  if (activeController) return activeController;
  const controller = createController();
  activeController = controller;
  try {
    await controller.initialize();
    return controller;
  } catch (error) {
    activeController = null;
    updateStatus({ state: "error", message: error?.message || "Cloud sync could not start." });
    throw error;
  }
};

export const stopCloudSync = () => {
  if (activeController) activeController.stop();
  activeController = null;
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
