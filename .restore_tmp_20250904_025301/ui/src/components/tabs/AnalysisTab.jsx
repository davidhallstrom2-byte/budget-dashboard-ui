// src/components/tabs/AnalysisTab.jsx
import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Eye, EyeOff } from "lucide-react";

export default function AnalysisTab({ pieData, totals, nonArchived, showOptimizations, setShowOptimizations }) {
  const suggestions = (() => {
    const list = [];
    if (totals.totalIncome === 0) {
      list.push({ type: "critical", title: "Add Income Source", description: "No income recorded. Add your expected income to balance your budget." });
    }
    const homeOfficeTotal = (nonArchived.homeOffice || []).reduce((s, i) => s + (i.estBudget || 0), 0);
    if (homeOfficeTotal > 80) {
      list.push({ type: "warning", title: "High Subscription Costs", description: "Consider consolidating subscriptions or downgrading tiers." });
    }
    const hasNetflix = (nonArchived.personal || []).find((x) => x.category === "Netflix")?.estBudget || 0;
    const hasParamount = (nonArchived.personal || []).find((x) => x.category === "Paramount+")?.estBudget || 0;
    if (hasNetflix > 0 && hasParamount > 0) {
      list.push({ type: "high", title: "Streaming Overlap", description: "Multiple streaming services detectedâ€”pause one or more to save." });
    }
    return list;
  })();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Category Spending Analysis</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={pieData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
          <button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md" onClick={() => setShowOptimizations((v) => !v)}>
            {showOptimizations ? <EyeOff className="inline h-4 w-4 mr-1" /> : <Eye className="inline h-4 w-4 mr-1" />}
            {showOptimizations ? "Hide actions" : "Show actions"}
          </button>
        </div>

        <div className="space-y-3">
          {suggestions.length ? suggestions.map((s, i) => (
            <div key={i} className={`p-4 rounded-xl border ${ s.type === "critical" ? "bg-red-50 border-red-500" : s.type === "high" ? "bg-orange-50 border-orange-500" : s.type === "warning" ? "bg-yellow-50 border-yellow-500" : "bg-blue-50 border-blue-500" }`}>
              <h4 className="font-semibold text-gray-900">{s.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{s.description}</p>
              {showOptimizations && <div className="mt-2 p-2 bg-white rounded border"><p className="text-sm">Try pausing or downgrading one of the overlapping services.</p></div>}
            </div>
          )) : <p className="text-sm text-gray-600">Nothing to optimize right now.</p>}
        </div>
      </div>
    </div>
  );
}


