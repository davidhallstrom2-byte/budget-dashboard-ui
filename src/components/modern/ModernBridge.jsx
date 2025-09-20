import React, { useMemo, useCallback } from "react";
import ModernBudgetPanel from "./ModernBudgetPanel.jsx";

// Canonical -> Legacy view
function canonToLegacy(appState) {
  const bd = appState?.budgetData || {};
  const out = {};
  for (const key of Object.keys(bd)) {
    const rows = Array.isArray(bd[key]) ? bd[key] : [];
    out[key] = rows.map(r => ({
      category: r?.name ?? "Item",
      estBudget: Number(r?.amount || 0),
      actualSpent: r?.paid ? Number(r?.amount || 0) : Number(r?.actualSpent || 0),
      bankSource: r?.paid ? "Paid" : (r?.notes || "Upcoming"),
      dueDate: r?.dueDate || null,
      archived: !!r?.archived,
      __id: r?.id,
      __orig: r
    }));
  }
  return { budgetData: out };
}

// Legacy view -> Canonical state
function legacyToCanon(legacyBD, prevCanon) {
  const out = { ...(prevCanon || {}) };
  const bd = {};
  for (const key of Object.keys(legacyBD || {})) {
    const rows = legacyBD[key] || [];
    bd[key] = rows.map((r) => {
      const prior = r.__orig || {};
      const amount = Number(r.estBudget || 0);
      const paid = String(r.bankSource || "").toLowerCase() === "paid";
      return {
        id: prior.id || r.__id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
        name: r.category ?? prior.name ?? "Item",
        amount,
        dueDate: r.dueDate || null,
        notes: paid ? (prior.notes || "Paid") : (r.bankSource || prior.notes || null),
        paid,
        archived: !!r.archived
      };
    });
  }
  out.budgetData = bd;
  return out;
}

export default function ModernBridge({ state }) {
  const legacyView = useMemo(() => canonToLegacy(state), [state]);

  const setStateShim = useCallback((updater) => {
    const legacyPrev = legacyView.budgetData;
    const legacyNext = typeof updater === "function" ? updater(legacyPrev) : updater;
    const nextCanon = legacyToCanon(legacyNext, state);

    // Instant UI update
    window.dispatchEvent(new CustomEvent("bd:replace-state-local", { detail: { state: nextCanon } }));

    // Persist + rehydrate
    (async () => {
      try {
        const r = await (window.saveCurrentState?.(nextCanon, 0));
        if (r?.ok) window.dispatchEvent(new Event("bd:replace-state"));
      } catch {}
    })();
  }, [legacyView, state]);

  return (
    <ModernBudgetPanel
      state={legacyView}
      setState={(fn) => setStateShim((prevLegacy) => ({ ...prevLegacy, ...{ ...fn(prevLegacy) } }))}
      showSuggestions={true}
    />
  );
}
