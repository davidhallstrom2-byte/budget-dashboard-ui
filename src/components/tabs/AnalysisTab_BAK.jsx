// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\tabs\AnalysisTab.jsx
import React, { useMemo } from "react";
import OptimizationSuggestions from "../modern/OptimizationSuggestions.jsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { loadState } from "../../utils/state";

export default function AnalysisTab() {
  const s = loadState();
  const data = s?.modernBudgetData || {};
  const barData = useMemo(() => {
    const keys = Object.keys(data).filter((k) => k !== "income");
    return keys.map((k) => ({
      name: k === "homeOffice" ? "Home Office" : k,
      value: (data[k] || []).filter(i=>!i.archived).reduce((sum, i) => sum + (i.estBudget || 0), 0),
    }));
  }, [data]);

  return (
    <div className="p-4 space-y-6">
      <OptimizationSuggestions />
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Category Analysis</h3>
        {barData.length ? (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-gray-500">No expense categories yet.</div>
        )}
      </div>
    </div>
  );
}
