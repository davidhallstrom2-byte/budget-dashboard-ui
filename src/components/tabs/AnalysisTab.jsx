// src/components/tabs/AnalysisTab.jsx
// Restored Analysis content: category spending chart, optimization suggestions, and health score.
// Pulls data from the Zustand store (useBudgetState). If store is empty, shows a gentle empty state.

import React, { useMemo, useState } from "react";
import { useBudgetState } from "../../utils/state";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Home,
  Car,
  ShoppingBag,
  Briefcase,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";

function useDerivedFromStore(asOfDate) {
  const data = useBudgetState((s) => s.data);

  const budget = useMemo(() => {
    if (data && typeof data === "object") return data;
    return null; // no fallback here, Analysis will show empty state when data is missing
  }, [data]);

  const totals = useMemo(() => {
    if (!budget) return { totalIncome: 0, totalExpenses: 0, totalAnnualSubs: 0, netIncome: 0 };
    const totalIncome = (budget.income || []).reduce((sum, i) => sum + (i.estBudget || 0), 0);
    let totalExpenses = 0;
    let totalAnnualSubs = 0;
    Object.keys(budget).forEach((k) => {
      if (k === "income") return;
      (budget[k] || []).forEach((item) => {
        totalExpenses += item.estBudget || 0;
        if (item.annualSub) totalAnnualSubs += item.annualSub || 0;
      });
    });
    return { totalIncome, totalExpenses, totalAnnualSubs, netIncome: totalIncome - totalExpenses };
  }, [budget]);

  const colors = {
    income: "#22c55e",
    housing: "#ef4444",
    transportation: "#3b82f6",
    food: "#f59e0b",
    personal: "#8b5cf6",
    homeOffice: "#06b6d4",
    banking: "#dc2626",
    misc: "#6b7280",
  };
  const getCategoryColor = (k) => colors[k] || "#9ca3af";

  const getCategoryIcon = (k) => {
    const map = {
      income: DollarSign,
      housing: Home,
      transportation: Car,
      food: ShoppingBag,
      personal: ShoppingBag,
      homeOffice: Briefcase,
      banking: CreditCard,
      misc: MoreHorizontal,
    };
    return map[k] || MoreHorizontal;
  };

  const categoryTotals = useMemo(() => {
    if (!budget) return [];
    return Object.keys(budget)
      .map((k) => {
        const total = (budget[k] || []).reduce((s, i) => s + (i.estBudget || 0), 0);
        return {
          key: k,
          name: k === "homeOffice" ? "Home Office" : k.charAt(0).toUpperCase() + k.slice(1),
          value: total,
          color: getCategoryColor(k),
        };
      })
      .filter((x) => x.value > 0);
  }, [budget]);

  const health = useMemo(() => {
    const { totalIncome, totalExpenses, netIncome } = totals;
    const savingsRate = totalIncome > 0 ? Math.max(0, netIncome) / totalIncome : 0;
    const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 1;
    const score = Math.max(0, Math.min(100, Math.round(60 * (1 - expenseRatio) + 40 * savingsRate)));
    return {
      savingsRate,
      expenseRatio,
      score,
      status: netIncome >= 0 ? "surplus" : "deficit",
    };
  }, [totals]);

  const optimizationSuggestions = useMemo(() => {
    if (!budget) return [];
    const list = [];
    if (totals.totalIncome === 0) {
      list.push({
        type: "critical",
        title: "Add Income Source",
        description: "No income recorded. Add your expected income to balance your budget.",
        savings: totals.totalExpenses,
        action: `Add income of $${totals.totalExpenses.toFixed(2)} to break even`,
      });
    }
    const homeOfficeTotal = (budget.homeOffice || []).reduce((s, i) => s + (i.estBudget || 0), 0);
    if (homeOfficeTotal > 80) {
      list.push({
        type: "warning",
        title: "High Subscription Costs",
        description: "Consider consolidating AI subscriptions or using free tiers.",
        savings: 50,
        action: "Cancel a trial and downgrade one AI service",
      });
    }
    const creditPayment = (budget.banking || []).find((i) => String(i.category).includes("Credit One"));
    if (creditPayment && creditPayment.estBudget > 0) {
      list.push({
        type: "high",
        title: "Credit Card Payment Due",
        description: "Minimum payment due soon. Avoid late fees and interest.",
        savings: 0,
        action: `Pay minimum $${Number(creditPayment.estBudget).toFixed(2)} immediately`,
      });
    }
    return list;
  }, [budget, totals]);

  return { budget, totals, categoryTotals, optimizationSuggestions, health, getCategoryIcon };
}

export default function AnalysisTab({ asOfDate: asOfDateProp }) {
  const [showOptimizations, setShowOptimizations] = useState(false);
  const asOfDate = asOfDateProp || new Date().toISOString().slice(0, 10);

  const { budget, totals, categoryTotals, optimizationSuggestions, health } = useDerivedFromStore(asOfDate);

  if (!budget) {
    return (
      <div className="p-6 rounded-lg border bg-white">
        <h3 className="text-lg font-semibold mb-2">Analysis</h3>
        <p className="text-sm text-gray-600">
          No budget data is loaded yet. Load data from the toolbar, or add items in the Editor tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Category Spending Analysis</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={categoryTotals}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <ReTooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
          <button
            onClick={() => setShowOptimizations((v) => !v)}
            className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            {showOptimizations ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showOptimizations ? "Hide" : "Show"} Details
          </button>
        </div>

        <div className="space-y-4">
          {optimizationSuggestions.map((s, i) => (
            <div
              key={`${s.title}-${i}`}
              className={`p-4 rounded-lg border-l-4 ${
                s.type === "critical"
                  ? "bg-red-50 border-red-500"
                  : s.type === "high"
                  ? "bg-orange-50 border-orange-500"
                  : s.type === "warning"
                  ? "bg-yellow-50 border-yellow-500"
                  : "bg-blue-50 border-blue-500"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{s.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                  {showOptimizations && (
                    <div className="mt-2 p-2 bg-white rounded border">
                      <p className="text-sm font-medium text-green-700">Action: {s.action}</p>
                      {s.savings > 0 && (
                        <p className="text-xs text-green-600">Potential monthly savings: ${Number(s.savings).toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-4 text-right">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      s.type === "critical"
                        ? "bg-red-100 text-red-800"
                        : s.type === "high"
                        ? "bg-orange-100 text-orange-800"
                        : s.type === "warning"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {s.type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {optimizationSuggestions.length === 0 && (
            <div className="p-4 rounded-lg border bg-gray-50 text-sm text-gray-600">
              No suggestions at the moment. Your setup looks lean.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Financial Health Score</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Overall Score</span>
            <span
              className={`font-bold text-2xl ${
                health.score >= 70 ? "text-green-600" : health.score >= 40 ? "text-yellow-600" : "text-red-600"
              }`}
            >
              {health.score}/100
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Income vs Expenses</span>
            <span className={totals.netIncome >= 0 ? "text-green-600" : "text-red-600"}>
              {totals.netIncome >= 0 ? "✓ Positive" : "✗ Negative"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Savings Rate</span>
            <span
              className={`font-medium ${
                health.savingsRate >= 0.2 ? "text-green-600" : health.savingsRate >= 0.1 ? "text-yellow-600" : "text-red-600"
              }`}
            >
              {(health.savingsRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Budget Status</span>
            <span className={health.status === "surplus" ? "text-green-600" : "text-red-600"}>
              {health.status === "surplus" ? "✓ Surplus" : "✗ Deficit"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
