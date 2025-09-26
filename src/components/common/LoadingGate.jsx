import React, { useEffect } from 'react';
import { useBudgetState } from '../../utils/state.js';

/**
 * LoadingGate
 * - Tolerates missing meta
 * - Defaults hydrated true and loading false
 * - Normalizes meta on mount so legacy backups do not get stuck
 */
export default function LoadingGate({ children }) {
  const meta = useBudgetState((s) => s.meta);

  const hydrated = meta?.hydrated ?? true;
  const loading = meta?.loading ?? false;
  const error = meta?.error ?? null;

  // Normalize meta for older backups that did not set defaults
  useEffect(() => {
    if (!meta || typeof meta.hydrated === 'undefined' || typeof meta.loading === 'undefined') {
      useBudgetState.setState((s) => ({
        meta: {
          hydrated: true,
          loading: false,
          error: null,
          asOfDate: s?.meta?.asOfDate || 'YYYY-MM-01',
        },
      }));
    }
  }, [meta]);

  if (loading || !hydrated) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
        {String(error)}
      </div>
    );
  }

  return <>{children}</>;
}
