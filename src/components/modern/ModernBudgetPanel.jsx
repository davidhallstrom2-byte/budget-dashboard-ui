// src/components/modern/ModernBudgetPanel.jsx
import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingDown, TrendingUp, Calendar,
} from "lucide-react";
import { useBudgetState } from "../../utils/state";

const COLORS = {
  income: "#22c55e",
  housing: "#ef4444",
  transportation: "#3b82f6",
  food: "#f59e0b",
  personal: "#8b5cf6",
  homeOffice: "#06b6d4",
  banking: "#dc2626",
  misc: "#6b7280",
};

function fmt(n) { return `$${Number(n || 0).toFixed(2)}`; }

export default function ModernBudgetPanel({ asOfDate }) {
  const data = useBudgetState((s) => s.data) || {};
  const setState = useBudgetState.setState;

  /* -------- totals & chart -------- */
  const { totals, chart } = useMemo(() => {
    const keys = Object.keys(data || {});
    let totalIncome = 0;
    let totalExpenses = 0;
    const chartRows = [];

    keys.forEach((k) => {
      const arr = Array.isArray(data[k]) ? data[k] : [];
      const sum = arr.reduce((s, i) => s + (Number(i.estBudget) || 0), 0);
      if (k === "income") totalIncome += sum;
      else {
        totalExpenses += sum;
        if (sum > 0) {
          chartRows.push({
            key: k,
            name: k === "homeOffice" ? "Home Office" : k.charAt(0).toUpperCase() + k.slice(1),
            value: sum,
            color: COLORS[k] || "#9ca3af",
          });
        }
      }
    });

    return {
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
      },
      chart: chartRows,
    };
  }, [data]);

  /* -------- upcoming payments (30d window from asOfDate) -------- */
  const upcoming = useMemo(() => {
    const today = new Date(asOfDate || new Date());
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const list = [];

    Object.keys(data || {}).forEach((k) => {
      (data[k] || []).forEach((it) => {
        if (!it.dueDate || !it.estBudget) return;
        const dd = new Date(it.dueDate);
        if (isNaN(dd)) return;
        const delta = Math.ceil((dd - today) / (1000 * 60 * 60 * 24));
        if (dd <= in30) {
          list.push({
            section: k,
            name: it.category || it.name,
            amount: Number(it.estBudget) || 0,
            dueDate: it.dueDate,
            daysUntil: delta,
            overdue: dd < today,
          });
        }
      });
    });

    list.sort((a, b) => {
      // overdue first, then soonest due
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.daysUntil - b.daysUntil;
    });
    return list;
  }, [data, asOfDate]);

  const dueSoonCount = upcoming.filter(x => x.daysUntil >= 0).length;

  /* -------- table actions -------- */
  function markPaid(section, idx) {
    setState((s) => {
      const next = { ...s.data };
      next[section] = next[section].map((it, i) =>
        i === idx ? { ...it, actualSpent: it.estBudget, bankSource: "Paid" } : it
      );
      return { data: next };
    });
  }
  function archiveItem(section, idx) {
    setState((s) => {
      const next = { ...s.data };
      next[section] = next[section].map((it, i) =>
        i === idx ? { ...it, bankSource: "Archived" } : it
      );
      return { data: next };
    });
  }
  function deleteItem(section, idx) {
    if (!window.confirm("Delete this item?")) return;
    setState((s) => {
      const next = { ...s.data };
      next[section] = next[section].filter((_, i) => i !== idx);
      return { data: next };
    });
  }

  /* -------- render -------- */
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-emerald-600 font-medium">Total Income</div>
              <div className="text-2xl font-bold">{fmt(totals.income)}</div>
            </div>
          </div>
        </div>

        <div className="bg-rose-50 rounded-xl border border-rose-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
              <TrendingDown className="text-rose-600" />
            </div>
            <div>
              <div className="text-sm text-rose-600 font-medium">Total Expenses</div>
              <div className="text-2xl font-bold text-rose-700">{fmt(totals.expenses)}</div>
            </div>
          </div>
        </div>

        <div className="bg-rose-50 rounded-xl border border-rose-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
              <TrendingUp className="text-rose-600" />
            </div>
            <div>
              <div className="text-sm text-rose-600 font-medium">Net Income</div>
              <div className="text-2xl font-bold text-rose-700">{fmt(totals.net)}</div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
              <Calendar className="text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-indigo-600 font-medium">Due Soon</div>
              <div className="text-2xl font-bold text-indigo-700">{dueSoonCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold mb-4">Expense Breakdown</h3>
          <div className="h-[340px]">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {chart.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">No expense data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold mb-4">Upcoming Payments</h3>
          <div className="text-sm text-gray-500 mb-3">
            {upcoming.length ? `${upcoming.length} payments in the next 30 days` : "No upcoming payments"}
          </div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {upcoming.slice(0, 8).map((p, i) => (
              <div key={i} className="rounded-lg border bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.name}</div>
                  <div className="font-semibold">{fmt(p.amount)}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {p.overdue
                    ? `${Math.abs(p.daysUntil)} days overdue`
                    : p.daysUntil === 0
                    ? "Due today"
                    : p.daysUntil === 1
                    ? "Due tomorrow"
                    : `In ${p.daysUntil} days`}{" "}
                  • {p.section === "banking" ? "Banking & Credit" : p.section}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete Budget List */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Complete Budget List</h3>
          <button
            className="inline-flex items-center rounded-md bg-blue-600 text-white text-sm font-medium px-3 py-2 hover:bg-blue-700"
            onClick={() => {
              // simple export here; you already have a fuller exporter in your Editor tab if you prefer
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `budget-report-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            ⬇ Download Report
          </button>
        </div>

        {/* table */}
        {Object.keys(data || {}).map((section) => {
          const rows = Array.isArray(data[section]) ? data[section] : [];
          const subtotal = rows.reduce((s, r) => s + (Number(r.estBudget) || 0), 0);
          return (
            <div key={section} className="mb-6">
              <div className="uppercase text-xs tracking-wide text-gray-500 font-semibold mb-2">
                {section === "homeOffice" ? "Home Office" : section}
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 py-2 px-3 text-xs font-medium text-gray-600">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Due Date</div>
                  <div className="col-span-2">Budget</div>
                  <div className="col-span-1">Actual</div>
                  <div className="col-span-2">Status</div>
                </div>

                {rows.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-500">No items</div>
                )}

                {rows.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center border-t py-2 px-3 text-sm">
                    <div className="col-span-5">{r.category || r.name}</div>
                    <div className="col-span-2 text-gray-600">{r.dueDate || <span className="text-gray-400">No due date</span>}</div>
                    <div className="col-span-2 font-semibold">{fmt(r.estBudget)}</div>
                    <div className="col-span-1">{fmt(r.actualSpent)}</div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          r.bankSource === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.bankSource === "Archived"
                            ? "bg-gray-200 text-gray-700"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {r.bankSource || "Pending"}
                      </span>

                      <button
                        className={`px-2 py-0.5 rounded text-xs border ${
                          r.bankSource === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        }`}
                        disabled={r.bankSource === "Paid"}
                        onClick={() => markPaid(section, idx)}
                      >
                        {r.bankSource === "Paid" ? "✓ Mark Paid" : "Mark Paid"}
                      </button>
                      <button
                        className="px-2 py-0.5 rounded text-xs border bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        onClick={() => archiveItem(section, idx)}
                      >
                        Archive
                      </button>
                      <button
                        className="px-2 py-0.5 rounded text-xs border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        onClick={() => deleteItem(section, idx)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                <div className="border-t px-3 py-2 text-sm text-right font-semibold">
                  {section} Subtotal: {fmt(subtotal)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
