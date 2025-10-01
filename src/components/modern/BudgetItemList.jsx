// src/components/modern/BudgetItemList.jsx
import React, { useMemo } from "react";

// Show a read-only table of budget rows across all non-income buckets.
// Sorted: Pending first, then by due date asc, then by amount desc.
// Columns: Item, Bucket, Est, Actual, Due, Status.

const BUCKET_ORDER = [
  "housing",
  "transportation",
  "food",
  "personal",
  "homeOffice",
  "banking",
  "subscriptions",
  "misc",
];

const BUCKET_LABEL = {
  income: "Income",
  housing: "Housing",
  transportation: "Transportation",
  food: "Food",
  personal: "Personal",
  homeOffice: "Home/Office",
  banking: "Banking & Credit",
  subscriptions: "Subscriptions",
  misc: "Miscellaneous",
};

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function isOverdue(dueISO) {
  if (!dueISO) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueISO < today;
}

export default function BudgetItemList({ buckets = {}, maxItems = 100 }) {
  // flatten rows across all non-income buckets
  const rows = useMemo(() => {
    const items = [];
    for (const bucket of BUCKET_ORDER) {
      const arr = Array.isArray(buckets[bucket]) ? buckets[bucket] : [];
      for (const r of arr) {
        items.push({
          id: r?.id || `${bucket}-${Math.random().toString(36).slice(2, 8)}`,
          bucket,
          bucketLabel: BUCKET_LABEL[bucket] || bucket,
          category: r?.category ?? "Item",
          estBudget: Number(r?.estBudget) || 0,
          actualCost: Number(r?.actualCost) || 0,
          dueDate: r?.dueDate || "",
          status: r?.status === "paid" ? "paid" : "pending",
        });
      }
    }
    // Pending first, then due date asc (blank dates last), then higher amount first
    return items
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        const ad = a.dueDate || "9999-12-31";
        const bd = b.dueDate || "9999-12-31";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return b.estBudget - a.estBudget;
      })
      .slice(0, maxItems);
  }, [buckets, maxItems]);

  if (!rows.length) {
    return (
      <div className="p-6 text-center text-slate-600">
        <div className="text-lg font-medium mb-1">No budget items found</div>
        <div className="text-sm">Add items in the Editor to see them here.</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-slate-600">
          <tr>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Bucket</th>
            <th className="px-4 py-3 text-right">Budgeted</th>
            <th className="px-4 py-3 text-right">Actual</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r) => (
            <tr key={r.id} className="bg-white hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-900">{r.category}</td>
              <td className="px-4 py-2 text-slate-700">{r.bucketLabel}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.estBudget)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.actualCost)}</td>
              <td className={`px-4 py-2 ${isOverdue(r.dueDate) && r.status === "pending" ? "text-rose-600 font-medium" : "text-slate-700"}`}>
                {r.dueDate || "—"}
              </td>
              <td className="px-4 py-2">
                <StatusPill status={r.status} overdue={isOverdue(r.dueDate)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status, overdue }) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (status === "paid") {
    return <span className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200`}>Paid</span>;
  }
  if (overdue) {
    return <span className={`${base} bg-rose-50 text-rose-700 border border-rose-200`}>Overdue</span>;
  }
  return <span className={`${base} bg-amber-50 text-amber-700 border border-amber-200`}>Pending</span>;
}
