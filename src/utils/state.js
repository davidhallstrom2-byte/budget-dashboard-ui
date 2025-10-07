// Budget Dashboard State Manager
// - React store with useBudgetState (selector support)
// - Cached snapshot to satisfy useSyncExternalStore stability
// - Stable selector outputs to prevent infinite loops (normalizes empty [] / {})
// - computeTotals exported (named) and on the snapshot
// - saveToServer compatibility for existing components
// - DUAL-SAVE: Saves to both standalone file AND WordPress database
// Data model per handoff brief (2025-09-29)

import { useSyncExternalStore } from "react";

const STATE_STORAGE_KEY = "budget-dashboard-state-v2";
let _bootLogged = false;

// Stable empty sentinels to avoid returning fresh [] / {} every render
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

// ---------------- Environment detection ----------------
function isViteDev() {
  return (
    typeof window !== "undefined" &&
    /(^127\.0\.0\.1:4174$|:4174$|localhost:4174$)/.test(window.location.host)
  );
}

function isWordPressHost() {
  return (
    typeof window !== "undefined" &&
    /(^|\.)main-dashboard\.local$/.test(window.location.hostname)
  );
}

// ---------------- Data URL resolution ----------------
function getDataUrlCandidates() {
  if (isViteDev()) {
    return ["/budget-dashboard-fs/restore/budget-data.json"];
  }
  return [
    "/budget-dashboard-fs/ui/public/restore/budget-data.json",
    "/budget-dashboard-fs/restore/budget-data.json",
  ];
}

async function fetchFirst(urls) {
  for (const url of urls) {
    try {
      const bust = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      const res = await fetch(bust, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // try next
    }
  }
  throw new Error("All data URLs failed");
}

// ---------------- Defaults and normalization ----------------
function defaultState() {
  return {
    buckets: {
      income: [],
      housing: [],
      transportation: [],
      food: [],
      personal: [],
      homeOffice: [],
      banking: [],
      subscriptions: [],
      emergencyFund: [],
      misc: [],
    },
    archived: [],
    meta: {
      categoryNames: {},
      categoryOrder: [],
      emergencyFund: {
        targetMonths: 6,
        currentAmount: 0
      }
    }
  };
}

function normalizeRow(row) {
  if (!row) return null;
  const out = { ...row };
  if (typeof out.actualSpent !== "undefined" && typeof out.actualCost === "undefined") {
    out.actualCost = out.actualSpent;
    delete out.actualSpent;
  }
  if (!out.status) out.status = "pending";
  if (!out.note) out.note = "";
  return out;
}

function normalizeState(input) {
  const base = defaultState();
  const s = { ...base, ...input };

  const bucketKeys = Object.keys(base.buckets);
  const outBuckets = {};
  for (const key of bucketKeys) {
    const arr = Array.isArray(s.buckets?.[key]) ? s.buckets[key] : [];
    outBuckets[key] = arr.map(normalizeRow).filter(Boolean);
  }

  // Auto-migrate obvious subscriptions
  const migrated = outBuckets.subscriptions.slice();
  for (const key of Object.keys(outBuckets)) {
    if (key === "subscriptions") continue;
    const keep = [];
    for (const row of outBuckets[key]) {
      if (typeof row.category === "string" && /subscription/i.test(row.category)) {
        migrated.push(row);
      } else {
        keep.push(row);
      }
    }
    outBuckets[key] = keep;
  }
  outBuckets.subscriptions = migrated;

  const archived = Array.isArray(s.archived) ? s.archived.slice() : [];
  return { buckets: outBuckets, archived };
}

// ---------------- Totals helpers ----------------
function computeTotalsFromBuckets(buckets) {
  const b = buckets || {};
  const income = Array.isArray(b.income) ? b.income : [];

  const totalIncome = income.reduce((s, r) => s + (Number(r.estBudget) || 0), 0);

  const expenseKeys = Object.keys(b).filter((k) => k !== "income");
  const totalExpenses = expenseKeys.reduce((sum, key) => {
    const rows = Array.isArray(b[key]) ? b[key] : [];
    return sum + rows.reduce((s, r) => s + (Number(r.estBudget) || 0), 0);
  }, 0);

  const netIncome = totalIncome - totalExpenses;

  const totalsByBucket = {};
  let grandEst = 0;
  let grandActual = 0;
  let grandPending = 0;
  let grandPaid = 0;

  for (const key of Object.keys(b)) {
    const rows = Array.isArray(b[key]) ? b[key] : [];
    const est = rows.reduce((s, r) => s + (Number(r.estBudget) || 0), 0);
    const actual = rows.reduce((s, r) => s + (Number(r.actualCost) || 0), 0);
    const pending = rows.reduce((s, r) => s + (r.status === "pending" ? 1 : 0), 0);
    const paid = rows.reduce((s, r) => s + (r.status === "paid" ? 1 : 0), 0);
    totalsByBucket[key] = { est, actual, diff: actual - est, pending, paid };
    grandEst += est;
    grandActual += actual;
    grandPending += pending;
    grandPaid += paid;
  }

  const grand = {
    est: grandEst,
    actual: grandActual,
    diff: grandActual - grandEst,
    pending: grandPending,
    paid: grandPaid,
  };

  return { totalIncome, totalExpenses, netIncome, totalsByBucket, grand };
}

// Public named export for legacy imports
export function computeTotals(buckets) {
  return computeTotalsFromBuckets(buckets || state.buckets);
}

// ---------------- Store and subscription ----------------
let state = defaultState();

// Cached snapshot for stability
let _snapshot = makeSnapshot(state);

function makeSnapshot(s) {
  const computeTotalsSnap = () => computeTotalsFromBuckets(s.buckets);
  return Object.freeze({ ...s, computeTotals: computeTotalsSnap });
}

const listeners = new Set();

function getSnapshot() {
  return _snapshot;
}

function getServerSnapshot() {
  return _snapshot;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  }
}

function replaceState(next) {
  state = next;
  _snapshot = makeSnapshot(state);
  saveToLocalStorage(state);
  emit();
}

// Selector-aware hook with stable fallbacks for empty values.
export function useBudgetState(selector) {
  const sel = typeof selector === "function" ? selector : (s) => s;

  const selectStable = (snap) => {
    const v = sel(snap);
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.length === 0 ? EMPTY_ARRAY : v;
    if (typeof v === "object") {
      if (Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === 0) {
        return EMPTY_OBJECT;
      }
    }
    return v;
  };

  const getSel = () => selectStable(getSnapshot());
  const getServerSel = () => selectStable(getServerSnapshot());
  return useSyncExternalStore(subscribe, getSel, getServerSel);
}

// ---------------- Local storage helpers ----------------
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.buckets && parsed.archived) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveToLocalStorage(s) {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ---------------- Public API ----------------
export function getState() {
  return state;
}

export async function initializeState() {
  try {
    const json = await fetchFirst(getDataUrlCandidates());
    const normalized = normalizeState(json);
    replaceState(normalized);
    if (!_bootLogged) {
      console.info("Loaded budget data from server or public file.");
      _bootLogged = true;
    }
    return state;
  } catch {
    const local = loadFromLocalStorage();
    if (local) {
      replaceState(normalizeState(local));
      if (!_bootLogged) {
        console.warn("Could not load from server, using local storage.");
        _bootLogged = true;
      }
      return state;
    }
    const fresh = defaultState();
    replaceState(fresh);
    if (!_bootLogged) {
      console.warn("Could not load from server, using defaults.");
      _bootLogged = true;
    }
    return state;
  }
}

export async function saveState() {
  return _saveInternal();
}

export async function saveToServer(stateOverride) {
  if (stateOverride && typeof stateOverride === "object") {
    replaceState(normalizeState(stateOverride));
  }
  const result = await _saveInternal();
  if (result.ok) return { success: true };
  return { success: false, error: result.error || "Save failed" };
}

// ---------------- DUAL-SAVE IMPLEMENTATION ----------------
async function _saveInternal() {
  const saveResults = {
    file: { attempted: false, success: false, error: null },
    database: { attempted: false, success: false, error: null, version: null },
    localStorage: { attempted: false, success: false }
  };

  try {
    saveToLocalStorage(state);
    saveResults.localStorage.attempted = true;
    saveResults.localStorage.success = true;
  } catch (err) {
    console.error('localStorage save failed:', err);
  }

  saveResults.file.attempted = true;
  try {
    const res = await fetch("/budget-dashboard-fs/save.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
      credentials: "same-origin",
    });

    if (res.ok) {
      const result = await res.json().catch(() => ({}));
      saveResults.file.success = true;
      console.log('✅ File save successful:', result.timestamp || 'saved');
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    saveResults.file.error = String(err);
    console.error('❌ File save failed:', err);
  }

  if (isWordPressHost()) {
    saveResults.database.attempted = true;
    try {
      const res = await fetch("/wp-json/budget/v1/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: state }),
        credentials: "same-origin",
      });

      if (res.ok) {
        const result = await res.json();
        saveResults.database.success = true;
        saveResults.database.version = result.version;
        console.log('✅ Database save successful, version:', result.version);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      saveResults.database.error = String(err);
      console.error('❌ Database save failed:', err);
    }
  }

  const fileOk = saveResults.file.success;
  const dbOk = saveResults.database.success;
  const localOk = saveResults.localStorage.success;

  const overallSuccess = fileOk || dbOk || localOk;

  let statusMsg = [];
  if (fileOk) statusMsg.push('File');
  if (dbOk) statusMsg.push(`Database (v${saveResults.database.version})`);
  if (localOk) statusMsg.push('Browser');

  let failMsg = [];
  if (!fileOk && saveResults.file.attempted) failMsg.push('File failed');
  if (!dbOk && saveResults.database.attempted) failMsg.push('Database failed');

  const finalMsg = statusMsg.length > 0
    ? `Saved to: ${statusMsg.join(', ')}${failMsg.length > 0 ? ' | ' + failMsg.join(', ') : ''}`
    : 'All save methods failed';

  console.log(`💾 Save complete: ${finalMsg}`);

  return {
    ok: overallSuccess,
    results: saveResults,
    message: finalMsg,
    error: !overallSuccess ? 'All save methods failed' : null
  };
}

// ---------------- Mutators ----------------
function assertBucket(bucket) {
  if (!state.buckets[bucket]) throw new Error(`Unknown bucket: ${bucket}`);
}

function cryptoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function addRow(bucket, rowData) {
  assertBucket(bucket);
  const row = normalizeRow({
    id: rowData?.id || cryptoId(),
    category: rowData?.category || "New Item",
    estBudget: Number.isFinite(rowData?.estBudget) ? rowData.estBudget : 0,
    actualCost: Number.isFinite(rowData?.actualCost) ? rowData.actualCost : 0,
    dueDate: rowData?.dueDate || todayISO(),
    status: rowData?.status || "pending",
  });
  const next = { ...state, buckets: { ...state.buckets, [bucket]: [...state.buckets[bucket], row] } };
  replaceState(next);
  return row;
}

export function updateRow(bucket, id, updates) {
  assertBucket(bucket);
  const idx = state.buckets[bucket].findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Row not found: ${id}`);
  const merged = normalizeRow({ ...state.buckets[bucket][idx], ...updates });
  const nextBucket = state.buckets[bucket].slice();
  nextBucket[idx] = merged;
  const next = { ...state, buckets: { ...state.buckets, [bucket]: nextBucket } };
  replaceState(next);
  return merged;
}

export function removeRow(bucket, id) {
  assertBucket(bucket);
  const nextBucket = state.buckets[bucket].filter((r) => r.id !== id);
  const next = { ...state, buckets: { ...state.buckets, [bucket]: nextBucket } };
  replaceState(next);
  return true;
}

export function archiveRow(bucket, id) {
  assertBucket(bucket);
  const idx = state.buckets[bucket].findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Row not found: ${id}`);
  const row = state.buckets[bucket][idx];
  const archivedItem = {
    ...row,
    originalBucket: bucket,
    archivedAt: new Date().toISOString(),
  };
  const nextBucket = state.buckets[bucket].slice();
  nextBucket.splice(idx, 1);
  const next = {
    ...state,
    buckets: { ...state.buckets, [bucket]: nextBucket },
    archived: [...state.archived, archivedItem],
  };
  replaceState(next);
  return archivedItem;
}

export function restoreArchivedRow(id) {
  const idx = state.archived.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Archived row not found: ${id}`);
  const item = state.archived[idx];
  const targetBucket =
    item.originalBucket && state.buckets[item.originalBucket]
      ? item.originalBucket
      : "misc";
  const { originalBucket, archivedAt, ...rowData } = item;
  const next = {
    ...state,
    archived: state.archived.filter((_, i) => i !== idx),
    buckets: {
      ...state.buckets,
      [targetBucket]: [...state.buckets[targetBucket], rowData],
    },
  };
  replaceState(next);
  return rowData;
}