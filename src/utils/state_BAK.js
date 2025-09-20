// src/utils/state.js
// Persistence helpers for the Budget Dashboard.
// NOTE: Intentionally NO exports named LS_KEY or ensureBootstrap.

const LS_KEY = "budget-dashboard-state-v1";

/** Safely load the saved app state from localStorage. */
export function loadState() {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LS_KEY)
        : null;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Minimal shape guard; keep it lenient to avoid breaking older saves.
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.budgetData || typeof parsed.budgetData !== "object") {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("[state.loadState] Failed to parse saved state:", err);
    return null;
  }
}

/** Safely save the app state to localStorage. */
export function saveState(state) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[state.saveState] Failed to save state:", err);
  }
}

/** Optional: default empty state for first run / reset flows. */
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
    },
    ui: {},
  };
}
