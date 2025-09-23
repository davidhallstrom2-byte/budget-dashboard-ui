// src/utils/state.js
// State store with hydration guard, reload control, restore validation,
// and a fallback SEED so the UI works "out of the box" if no data exists.
//
// Exports: useBudgetState, hydrateFromDB, subscribe

import { create } from "zustand";

/* ----------------------------- Seeded dataset ----------------------------- */
const SEED_BUDGET = {
  income: [
    { category: "Income", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
  ],
  housing: [
    { category: "Rent", estBudget: 0, actualSpent: 0, dueDate: "2025-09-01", bankSource: "Upcoming" },
    { category: "Spectrum Internet", estBudget: 132.25, actualSpent: 0, dueDate: "2025-09-09", bankSource: "Upcoming" },
    { category: "Spectrum Mobile", estBudget: 325.40, actualSpent: 0, dueDate: "2025-09-04", bankSource: "Upcoming" },
  ],
  transportation: [
    { category: "Gas/Fuel", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Car Insurance", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Maintenance", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Uber One", estBudget: 9.99, actualSpent: 0, dueDate: "2025-09-14", bankSource: "Upcoming" },
  ],
  food: [
    { category: "Groceries", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Restaurants/Dining Out", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Street Food", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Instacart", estBudget: 0, actualSpent: 0, dueDate: "2025-09-23", bankSource: "Upcoming", annualSub: 79.00 },
  ],
  personal: [
    { category: "Shopping/Clothes", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Netflix", estBudget: 24.99, actualSpent: 0, dueDate: "2025-09-05", bankSource: "Upcoming" },
    { category: "Paramount Plus", estBudget: 12.99, actualSpent: 0, dueDate: "2025-09-10", bankSource: "Upcoming" },
    { category: "Amazon Prime", estBudget: 7.67, actualSpent: 0, dueDate: "2025-09-30", bankSource: "Upcoming" },
    { category: "CVS ExtraCare", estBudget: 5.48, actualSpent: 0, dueDate: "2025-09-16", bankSource: "Upcoming" },
  ],
  homeOffice: [
    { category: "LinkedIn Premium", estBudget: 29.99, actualSpent: 0, dueDate: "2025-09-19", bankSource: "Upcoming" },
    { category: "Google AI Pro", estBudget: 19.99, actualSpent: 0, dueDate: "2025-09-20", bankSource: "Upcoming" },
    { category: "ChatGPT Plus", estBudget: 19.99, actualSpent: 0, dueDate: "2025-08-27", bankSource: "Upcoming" },
    { category: "SuperGrok (trial)", estBudget: 30.00, actualSpent: 0, dueDate: "2025-09-14", bankSource: "Upcoming" },
  ],
  banking: [
    { category: "Wells Fargo Service Fee", estBudget: 25.00, actualSpent: 0, dueDate: "2025-09-01", bankSource: "Upcoming" },
    { category: "Credit One Bank", estBudget: 43.00, actualSpent: 0, dueDate: "2025-08-22", bankSource: "Upcoming" },
  ],
  misc: [
    { category: "Gifts/Donations", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
    { category: "Entertainment", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming" },
  ],
};

/* --------------------------- helpers: validation --------------------------- */
function validateRestoreData(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { ok: false, message: "Restore file is not a valid JSON object." };
  }
  const keys = Object.keys(candidate || {});
  if (keys.length === 0) {
    return { ok: false, message: "Restore file is empty." };
  }
  // Loosely check for plausible shapes
  const plausible =
    candidate.income || candidate.housing || candidate.data || candidate.sections || candidate.categories || candidate.items || candidate.rows;
  if (!plausible) {
    return { ok: false, message: "Restore JSON missing expected budget fields." };
  }
  return { ok: true };
}

/* ---------------------------- helpers: path build -------------------------- */
function buildRestorePath() {
  const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
  return `${base}restore/budget-data.json`;
}

/* ---------------------------- restore file loader -------------------------- */
async function fetchRestoreJson() {
  const restorePath = buildRestorePath();
  try {
    const res = await fetch(restorePath, {
      cache: "no-store",
      headers: { Accept: "application/json" }, // avoid SPA fallback rewrites
    });

    if (!res.ok) {
      return { ok: false, data: null, message: `Restore not found at ${restorePath} (HTTP ${res.status}).` };
    }

    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) {
      return { ok: false, data: null, message: `Expected JSON at ${restorePath}, got content-type "${ctype}".` };
    }

    const data = await res.json();
    const verdict = validateRestoreData(data);
    if (!verdict.ok) return { ok: false, data: null, message: verdict.message };
    return { ok: true, data, message: null };
  } catch {
    return { ok: false, data: null, message: "Failed to read restore file. Check JSON validity and path." };
  }
}

/* ---------------------------------- store --------------------------------- */
export const useBudgetState = create((set, get) => ({
  data: null,
  meta: {
    hydrated: false,
    loading: false,
    error: null,
    restore: { used: false, checked: false, message: null },
    seeded: false, // <- true when we use SEED_BUDGET as fallback
  },

  _setHydrationState(next) {
    set((s) => ({ meta: { ...s.meta, ...next } }));
  },

  async reloadData() {
    const { _setHydrationState } = get();
    _setHydrationState({
      loading: true,
      hydrated: false,
      error: null,
      restore: { used: false, checked: false, message: null },
      seeded: false,
    });
    try {
      await hydrateFromDB();
    } finally {
      get()._setHydrationState({ loading: false });
    }
  },
}));

// For components using direct subscription
export const subscribe = useBudgetState.subscribe;

/* ----------------------------- hydration entry ---------------------------- */
export async function hydrateFromDB() {
  const { _setHydrationState } = useBudgetState.getState();
  _setHydrationState({ loading: true, error: null });

  try {
    // 1) Your real loader (replace stub)
    const primaryOk = await existingHydrateIntoStore();
    if (primaryOk) {
      _setHydrationState({ hydrated: true, loading: false, error: null, seeded: false });
      return;
    }

    // 2) Optional restore
    const restore = await fetchRestoreJson();
    if (restore.ok) {
      useBudgetState.setState((s) => ({
        data: normalizeBudgetShape(restore.data),
        meta: {
          ...s.meta,
          hydrated: true,
          loading: false,
          error: null,
          restore: { used: true, checked: true, message: null },
          seeded: false,
        },
      }));
      return;
    }

    // 3) Fallback seed (so the UI works even with no data)
    useBudgetState.setState((s) => ({
      data: SEED_BUDGET,
      meta: {
        ...s.meta,
        hydrated: true,
        loading: false,
        error: null, // no error, we intentionally seed
        restore: { used: false, checked: true, message: restore.message || null },
        seeded: true,
      },
    }));
  } catch {
    // If anything truly blows up, at least show the seed so the app is usable
    useBudgetState.setState((s) => ({
      data: SEED_BUDGET,
      meta: {
        ...s.meta,
        hydrated: true,
        loading: false,
        error: null,
        restore: { used: false, checked: true, message: "Primary hydration failed; using seed." },
        seeded: true,
    }}));
  }
}

/* ----------------------------- existing loader ---------------------------- */
async function existingHydrateIntoStore() {
  // TODO: replace with your real IndexedDB/remote load and return true on success.
  // e.g. useBudgetState.setState({ data: loadedData }); return true;
  return false;
}

/* ----------------------------- shape normalizer --------------------------- */
function normalizeBudgetShape(raw) {
  // If restore.json uses a different envelope (e.g., {data: {...}}), unwrap.
  if (raw && raw.data && typeof raw.data === "object") return raw.data;
  return raw;
}

/* ------------------------------ auto-hydration ---------------------------- */
(async () => {
  const { meta } = useBudgetState.getState();
  if (!meta.hydrated && !meta.loading) {
    try {
      await hydrateFromDB();
    } finally {
      useBudgetState.getState()._setHydrationState({ loading: false });
    }
  }
})();
