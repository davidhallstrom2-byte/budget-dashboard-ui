// src/components/tabs/DashboardTab.jsx
import React from "react";
import ModernBudgetPanel from "../modern/ModernBudgetPanel.jsx";
import FinancialHealthCard from "../modern/FinancialHealthCard.jsx";
import HealthRecommendations from "../modern/HealthRecommendations.jsx";
import { useBudgetState } from '../../utils/state';

export default function DashboardTab({ state, setState }) {
  // Get totals and buckets for Financial Health Score
  const computeTotals = useBudgetState((s) => s.computeTotals);
  const buckets = useBudgetState((s) => s.buckets);
  const totals = computeTotals();

  return (
    <div className="space-y-6">
      {/* Financial Health Score Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialHealthCard totals={totals} buckets={buckets} />
        <HealthRecommendations totals={totals} buckets={buckets} />
      </div>

      {/* Existing Modern Budget Panel */}
      <ModernBudgetPanel state={state} setState={setState} showSuggestions />
    </div>
  );
}