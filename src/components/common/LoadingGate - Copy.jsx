// src/components/common/LoadingGate.jsx
// Minimal loading/error wrapper that defers panel rendering until hydrated.

import React from "react";
import { useBudgetState } from "../../utils/state";

export default function LoadingGate({ children }) {
  const hydrated = useBudgetState((s) => s.meta.hydrated);
  const loading = useBudgetState((s) => s.meta.loading);
  const error = useBudgetState((s) => s.meta.error);
  const reloadData = useBudgetState((s) => s.reloadData);
  const restore = useBudgetState((s) => s.meta.restore);

  if (loading && !hydrated) {
    return (
      <div className="w-full p-6">
        <div className="animate-pulse rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4 h-6 w-48 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200" />
          <div className="mb-2 h-4 w-5/6 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-4/6 rounded bg-gray-200" />
        </div>
        <p className="mt-4 text-sm text-gray-600">Loading budget data…</p>
      </div>
    );
  }

  if (error && !hydrated) {
    return (
      <div className="w-full p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h3 className="mb-2 text-lg font-semibold">Could not load data</h3>
          <p className="mb-4 text-sm">
            {error}
            {restore?.checked && restore?.message
              ? ` (${restore.message})`
              : ""}
          </p>
          <button
            type="button"
            onClick={reloadData}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only render content once hydrated to avoid empty totals/flash
  return <>{children}</>;
}
