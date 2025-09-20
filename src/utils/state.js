// DB-primary state manager with localStorage cache + optimistic versioning.
// Exports: subscribe, getState, setState, hydrate, loadState, saveState, createEmptyState.

const LS_KEY = "budget-dashboard-state-v1";

let _state = null;
let _version = 0;
let _subs = new Set();
let _saveTimer = null;

/* ---------------------------- localStorage ---------------------------- */
export function loadState() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}
export function saveState(s) {
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

/* ------------------------------- defaults ---------------------------- */
export function createEmptyState() {
  return {
    budgetData: {
      income: [],
      housing: [],
      transportation: [],
      food: [],
      personal: [],
      homeOffice: [],
      banking: [],
      misc: [],
      savings: [],
      emergencyFund: [],
    },
    archived: [],
    ui: {
      sections: [
        "income","housing","transportation","food",
        "personal","homeOffice","banking","misc","savings","emergencyFund",
      ],
      labels: {},
      subscriptions: [],
    },
  };
}

/* ------------------------------- pub/sub ----------------------------- */
function notify() { for (const fn of _subs) { try { fn(_state); } catch {} } }
export function subscribe(cb) {
  _subs.add(cb);
  if (_state) cb(_state);        // push immediately
  return () => _subs.delete(cb);
}
export function getState() { return _state; }

/* ----------------------------- persistence --------------------------- */
function debouncedSaveToDB() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const res = await (window.saveCurrentState?.(_state, _version));
      if (res?.ok && typeof res.version === "number") _version = res.version;
    } catch {}
  }, 250);
}
export function setState(next) {
  _state = next;
  saveState(_state);
  notify();
  debouncedSaveToDB();
}

/* -------------------------------- hydrate ---------------------------- */
export async function hydrate() {
  try {
    const r = await (window.getCurrentState?.());
    if (r?.ok && r.state) {
      _state = r.state;
      _version = r.version ?? 0;
      saveState(_state);
      notify();
      return;
    }
  } catch {}
  _state = loadState() || createEmptyState();
  _version = 0;
  saveState(_state);
  notify();
}

/* ------------------------------- events ------------------------------ */
function ensureSection(state, key) {
  if (!state.budgetData) state.budgetData = {};
  if (!Array.isArray(state.budgetData[key])) state.budgetData[key] = [];
  if (!state.ui) state.ui = {};
  if (!Array.isArray(state.ui.sections)) state.ui.sections = [];
  if (!state.ui.sections.includes(key)) state.ui.sections.push(key);
}
window.addEventListener("bd:replace-state", () => { hydrate(); });

window.addEventListener("bd:replace-state-local", (ev) => {
  const next = ev?.detail?.state;
  if (!next || typeof next !== "object") return;
  _state = next;
  _version = 0;
  saveState(_state);
  notify();
  debouncedSaveToDB();
});

// Keep this (importers may still use it)
window.addEventListener("bd:import-items", (ev) => {
  const items = ev?.detail?.items;
  if (!Array.isArray(items) || !items.length) return;
  const base = _state || createEmptyState();
  const next = structuredClone(base);
  for (const it of items) {
    if (!it || typeof it !== "object" || !it.categoryKey || !it.name) continue;
    ensureSection(next, it.categoryKey);
    next.budgetData[it.categoryKey] = [...next.budgetData[it.categoryKey], it];
  }
  setState(next);
});

/* ------------------------------ bootstrap ---------------------------- */
if (!_state) _state = loadState() || createEmptyState();
