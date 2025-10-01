import React, { useEffect, useState } from "react";
import { initializeState } from "../../utils/state.js";

/**
 * LoadingGate
 * Initializes the budget state exactly once and renders children after load.
 * Quiet under React 18 Strict Mode by memoizing a single global init promise.
 */
export default function LoadingGate({ children, fallback = null }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Global init lock to avoid duplicate initializeState() in Strict Mode
    if (!window.__BUDGET_INIT_PROMISE__) {
      window.__BUDGET_INIT_PROMISE__ = initializeState();
    }

    window.__BUDGET_INIT_PROMISE__
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setReady(true); // let the app render even if we fell back to defaults
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    // Minimal, quiet loader. Provide a default fallback if none is passed.
    if (fallback !== null) return fallback;
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
            />
          </svg>
          <span>Loading budget data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // Non-blocking error display, keeps noise out of the console
    return (
      <div className="w-full p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
        Failed to load from server, using local storage or defaults. Details: {error}
        <div className="mt-2 text-slate-600">
          You can continue. Data will persist locally during development.
        </div>
        <div className="mt-4">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
}
