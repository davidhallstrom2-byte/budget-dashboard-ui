// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\modern\ModernBudgetPanel.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Calendar,
  AlertTriangle, Download, ArchiveRestore, Trash2, Eye, EyeOff
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Tooltip, Cell
} from "recharts";

/* ------- small helpers ------- */
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const labelFor = (k) => (k === "homeOffice" ? "Home Office" : k === "banking" ? "Banking & Credit" : k);
const chartColors = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316","#6b7280"];

const Toast = ({ toast, onClose, onUndo }) => (
  <div className={`max-w-sm w-full p-4 flex items-start gap-3 rounded-2xl border shadow-lg bg-white ${toast.type==="success"?"border-green-200 bg-green-50":toast.type==="error"?"border-red-200 bg-red-50":"border-gray-200"}`}>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900">{toast.message}</p>
      {toast.onUndo && (
        <button onClick={() => onUndo(toast)} className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">
          Undo
        </button>
      )}
    </div>
    <button onClick={() => onClose(toast.id)} className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600">
      ✕
    </button>
  </div>
);

const Toasts = ({ toasts, onClose, onUndo }) =>
  !toasts?.length ? null : (
    <div className="fixed bottom-4 right-4 space-y-3 z-50">
      {toasts.map((t) => <Toast key={t.id} toast={t} onClose={onClose} onUndo={onUndo} />)}
    </div>
  );

const ArchivedDrawer = ({ open, onClose, items, onUnarchive, onDelete }) => {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Archived Items ({items.length})</h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-600">
              No archived items found.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(({ cat, idx, item, label }, i) => (
                <div key={`${cat}-${idx}-${i}`} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{item.category}</h3>
                      <p className="text-xs text-gray-500">{label}{item.dueDate ? ` • Due ${item.dueDate}` : ""}</p>
                    </div>
                    <div className="font-semibold">{money(item.estBudget)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onUnarchive(cat, idx)} className="flex-1 px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">
                      <ArchiveRestore className="inline h-3 w-3 mr-1" />
                      Unarchive
                    </button>
                    <button onClick={() => onDelete(cat, idx)} className="flex-1 px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">
                      <Trash2 className="inline h-3 w-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ------- main panel ------- */
export default function ModernBudgetPanel({ state, setState, showSuggestions = false }) {
  const budget = state?.budgetData || {};

  // derive views
  const nonArchived = useMemo(() => {
    const o = {};
    for (const k of Object.keys(budget)) o[k] = (budget[k] || []).filter((i) => !i.archived);
    return o;
  }, [budget]);

  const totals = useMemo(() => {
    const totalIncome = (nonArchived.income || []).reduce((s, i) => s + (Number(i.estBudget) || 0), 0);
    let totalExpenses = 0;
    Object.keys(nonArchived).forEach((k) => {
      if (k !== "income") (nonArchived[k] || []).forEach((i) => (totalExpenses += Number(i.estBudget) || 0));
    });
    return { totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses };
  }, [nonArchived]);

  const pieData = useMemo(() =>
    Object.keys(nonArchived)
      .filter((k) => k !== "income")
      .map((k) => ({
        name: labelFor(k),
        value: (nonArchived[k] || []).reduce((s, i) => s + (Number(i.estBudget) || 0), 0),
      }))
  , [nonArchived]);

  const upcoming = useMemo(() => {
    const out = [];
    const now = new Date();
    Object.keys(nonArchived).forEach((k) => {
      if (k === "income") return;
      (nonArchived[k] || []).forEach((i) => {
        if (!i.dueDate || i.bankSource === "Paid") return;
        const d = new Date(i.dueDate);
        const days = Math.ceil((d - now) / 86400000);
        out.push({
          section: labelFor(k),
          title: i.category,
          estBudget: Number(i.estBudget) || 0,
          days,
          priority: days <= 3 ? "high" : days <= 7 ? "medium" : "low",
        });
      });
    });
    return out.sort((a, b) => a.days - b.days).slice(0, 5);
  }, [nonArchived]);

  const archivedList = useMemo(() => {
    const out = [];
    for (const cat of Object.keys(budget)) {
      (budget[cat] || []).forEach((item, idx) => {
        if (item.archived) out.push({ cat, idx, item, label: labelFor(cat) });
      });
    }
    return out;
  }, [budget]);

  // toasts
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tid = timers.current.get(id);
    if (tid) { clearTimeout(tid); timers.current.delete(id); }
  }, []);
  const toast = useCallback((msg, onUndo = null, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    timers.current.set(id, setTimeout(() => removeToast(id), 5000));
    setToasts((t) => [...t, { id, message: msg, onUndo: onUndo || null, type }]);
  }, [removeToast]);

  // actions (update shared app state)
  const update = (mutator) =>
    setState((prev) => ({ ...prev, budgetData: mutator({ ...(prev?.budgetData || {}) }) }));

  const markPaid = (cat, idx) =>
    update((bd) => {
      bd[cat] = bd[cat].map((it, i) => (i === idx ? { ...it, bankSource: "Paid", actualSpent: it.estBudget } : it));
      return bd;
    });

  const toggleArchive = (cat, idx) =>
    update((bd) => {
      bd[cat] = bd[cat].map((it, i) => (i === idx ? { ...it, archived: !it.archived } : it));
      return bd;
    });

  const deleteItem = (cat, idx) =>
    update((bd) => {
      const item = bd[cat][idx];
      bd[cat] = bd[cat].filter((_, i) => i !== idx);
      toast(`Deleted "${item.category}" from ${labelFor(cat)}.`, () => {
        setState((prev) => {
          const b = { ...(prev?.budgetData || {}) };
          const arr = [...(b[cat] || [])];
          arr.splice(idx, 0, item);
          b[cat] = arr;
          return { ...prev, budgetData: b };
        });
      });
      return bd;
    });

  /* -------- FULL REPORT EXPORT (Complete Budget List) -------- */
  const downloadHtml = () => {
    const bd = state?.budgetData || {};

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

    // Build one section table (Income, Housing, etc.), non-archived by default
    const sectionTable = (key) => {
      const label = labelFor(key);
      const items = (bd[key] || []).filter((i) => !i.archived);
      if (!items.length) return "";

      const rows = items
        .map((it) => {
          const days =
            it.dueDate && !Number.isNaN(new Date(it.dueDate).getTime())
              ? Math.ceil((new Date(it.dueDate) - new Date()) / 86400000)
              : null;

          const when =
            it.dueDate
              ? `${esc(it.dueDate)}${
                  days === null
                    ? ""
                    : ` <span class="muted">(${
                        days === 0
                          ? "Due Today"
                          : days === 1
                          ? "Due Tomorrow"
                          : days < 0
                          ? `${Math.abs(days)} days overdue`
                          : `${days} days left`
                      })</span>`
                }`
              : '<span class="muted">No due date</span>';

          const status =
            it.bankSource === "Paid"
              ? '<span class="chip chip-green">Paid</span>'
              : it.actualSpent > 0
              ? '<span class="chip chip-amber">Partial</span>'
              : '<span class="chip">Pending</span>';

          return `
            <tr>
              <td>${esc(it.category)}</td>
              <td>${when}</td>
              <td class="num">${fmtMoney(it.estBudget)}</td>
              <td class="num">${fmtMoney(it.actualSpent)}</td>
              <td class="right">${status}</td>
            </tr>
          `;
        })
        .join("");

      const subBudget = items.reduce((s, i) => s + (Number(i.estBudget) || 0), 0);
      const subActual = items.reduce((s, i) => s + (Number(i.actualSpent) || 0), 0);

      return `
        <h2 class="section">${esc(label)}</h2>
        <table class="grid">
          <thead>
            <tr>
              <th>Item</th>
              <th>Due Date</th>
              <th class="num">Budget</th>
              <th class="num">Actual</th>
              <th class="right">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr class="subtotal">
              <td colspan="2" class="right">${esc(label)} Subtotal</td>
              <td class="num strong">${fmtMoney(subBudget)}</td>
              <td class="num strong">${fmtMoney(subActual)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
    };

    const sectionsHtml = Object.keys(bd)
      .map((k) => sectionTable(k))
      .filter(Boolean)
      .join("\n");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Budget Report</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color:#0f172a; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    .muted { color: #64748b; }
    .meta { margin: 0 0 20px; color:#334155; }
    .cards { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap:12px; margin: 16px 0 20px; }
    .card { border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; background:#f8fafc; }
      .card .label { font-size:12px; color:#2563eb; margin-bottom:4px; }
      .card .value { font-weight:700; font-size:20px; }
    .section { margin:28px 0 8px; font-size:16px; text-transform:uppercase; letter-spacing:.04em; color:#334155; }
    table.grid { width:100%; border-collapse: collapse; margin: 6px 0 18px; }
    table.grid th, table.grid td { border:1px solid #e2e8f0; padding:8px 10px; vertical-align:top; }
    table.grid thead th { background:#f1f5f9; text-align:left; font-size:12px; color:#475569; }
    .num { text-align:right; white-space:nowrap; }
    .right { text-align:right; }
    .strong { font-weight:700; }
    tfoot .subtotal td { background:#eff6ff; }
    .chip { display:inline-block; padding:2px 8px; border-radius:999px; background:#e2e8f0; color:#0f172a; font-size:12px; }
    .chip-amber { background:#fef3c7; color:#92400e; }
    .chip-green { background:#dcfce7; color:#065f46; }
    @media print { body { margin: 8mm; } .cards { grid-template-columns: repeat(4,1fr); } }
  </style>
</head>
<body>
  <h1>Budget Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()}</p>
  ${sectionsHtml || "<p>No items to display.</p>"}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-report-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Report downloaded successfully", null, "success");
  };
  /* -------- END EXPORT -------- */

  // simple analysis suggestions (optional)
  const [showDetails, setShowDetails] = useState(false);
  const suggestions = useMemo(() => {
    const list = [];
    if (totals.totalIncome === 0) list.push({ type: "critical", title: "Add Income Source", description: "No income recorded. Add expected income to see your true position." });
    const ai = (nonArchived.homeOffice || []).filter((i) =>
      ["ChatGPT","Google AI","SuperGrok"].some((s) => (i.category || "").includes(s))
    );
    const aiCost = ai.reduce((s, i) => s + (Number(i.estBudget) || 0), 0);
    if (aiCost > 50) list.push({ type: "medium", title: "Multiple AI Subscriptions", description: `$${aiCost.toFixed(2)}/mo on AI tools.` });
    return list;
  }, [nonArchived, totals.totalIncome]);

  /* ------- render ------- */
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-green-600">Total Income</p>
              <p className="text-2xl font-bold text-green-900">{money(totals.totalIncome)}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900">{money(totals.totalExpenses)}</p>
            </div>
          </div>
        </div>
        <div className={`p-6 rounded-2xl border shadow-sm ${totals.netIncome>=0?"bg-green-50 border-green-200":"bg-red-50 border-red-200"}`}>
          <div className="flex items-center">
            {totals.netIncome>=0 ? <TrendingUp className="h-8 w-8 text-green-600" /> : <TrendingDown className="h-8 w-8 text-red-600" />}
            <div className="ml-4">
              <p className={`text-sm font-medium ${totals.netIncome>=0?"text-green-600":"text-red-600"}`}>Net Income</p>
              <p className={`text-2xl font-bold ${totals.netIncome>=0?"text-green-900":"text-red-900"}`}>{money(totals.netIncome)}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Due Soon</p>
              <p className="text-2xl font-bold text-blue-900">{upcoming.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expense chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
          {pieData?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value"
                     label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No expense data available</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Upcoming Payments</h3>
          <div className="space-y-3">
            {upcoming.length ? upcoming.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.days===0?"Due Today":p.days===1?"Due Tomorrow":p.days<0?`${Math.abs(p.days)} days overdue`:`Due in ${p.days} days`} • {p.section}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-semibold">{money(p.estBudget)}</span>
                </div>
              </div>
            )) : <p className="text-sm text-gray-600">No upcoming payments</p>}
          </div>
        </div>
      </div>

      {/* COMPLETE BUDGET LIST */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Complete Budget List</h3>
          <button onClick={downloadHtml} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="h-4 w-4" /> Download Report
          </button>
        </div>

        <div className="space-y-6">
          {Object.keys(budget).map((key) => {
            const categoryItems = budget[key] || [];
            const activeItems = categoryItems.filter((i) => !i.archived);
            if (!activeItems.length) return null;

            const subBudget = activeItems.reduce((s, i) => s + (Number(i.estBudget) || 0), 0);
            const subActual = activeItems.reduce((s, i) => s + (Number(i.actualSpent) || 0), 0);
            const label = labelFor(key);

            return (
              <div key={key}>
                {/* Section header */}
                <div className="mb-2 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  {label}
                </div>

                {/* Column labels placed directly under each section header */}
                <div className="hidden sm:grid sm:grid-cols-12 text-xs font-semibold text-gray-600 border-b pb-3 mb-2">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-3">Due Date</div>
                  <div className="col-span-1 text-right">Budget</div>
                  <div className="col-span-1 text-right">Actual</div>
                  <div className="col-span-1 text-right">Status</div>
                </div>

                {/* Items */}
                <div className="divide-y rounded-xl border bg-gray-50">
                  {activeItems.map((item, idx) => {
                    const days = item.dueDate ? Math.ceil((new Date(item.dueDate) - new Date()) / 86400000) : null;
                    const rowTone =
                      item.bankSource === "Paid" ? "bg-green-50 border-l-4 border-l-green-500" :
                      days !== null && days <= 0 ? "bg-red-50 border-l-4 border-l-red-500" :
                      days !== null && days <= 3 ? "bg-amber-50 border-l-4 border-l-amber-500" :
                      "bg-white";
                    return (
                      <div key={idx} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-4 ${rowTone}`}>
                        {/* Item (name) */}
                        <div className="sm:col-span-6">
                          <span className="font-medium text-gray-900">{item.category}</span>
                          {/* Mobile-only details */}
                          <div className="sm:hidden text-xs text-gray-500 mt-1 space-y-1">
                            {item.dueDate && <div>Due: {item.dueDate}</div>}
                            <div className="flex justify-between"><span>Budget: {money(item.estBudget)}</span><span>Actual: {money(item.actualSpent)}</span></div>
                          </div>
                        </div>

                        {/* Due Date */}
                        <div className="hidden sm:block sm:col-span-3 text-gray-600 text-sm">
                          {item.dueDate ? (
                            <>
                              <div>{item.dueDate}</div>
                              {days !== null && (
                                <div className="text-xs text-gray-500">
                                  {days===0?"Due Today":days===1?"Due Tomorrow":days<0?`${Math.abs(days)} overdue`:`${days} days left`}
                                </div>
                              )}
                            </>
                          ) : <span className="text-gray-400">No due date</span>}
                        </div>

                        {/* Budget */}
                        <div className="hidden sm:block sm:col-span-1 text-right font-medium text-gray-900">{money(item.estBudget)}</div>

                        {/* Actual */}
                        <div className="hidden sm:block sm:col-span-1 text-right text-gray-700">{money(item.actualSpent)}</div>

                        {/* Status */}
                        <div className="sm:col-span-1 text-right">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            item.bankSource==="Paid" ? "bg-green-100 text-green-800"
                              : item.actualSpent>0 ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {item.bankSource==="Paid" ? "Paid" : item.actualSpent>0 ? "Partial" : "Pending"}
                          </span>
                        </div>

                        {/* Actions row */}
                        <div className="sm:col-span-12 flex justify-end gap-2">
                          {item.bankSource !== "Paid" && (
                            <button
                              onClick={() => { markPaid(key, idx); toast(`Marked "${item.category}" as paid.`, null, "success"); }}
                              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-md">
                              Mark Paid
                            </button>
                          )}
                          <button onClick={() => toggleArchive(key, idx)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md">
                            {item.archived ? "Unarchive" : "Archive"}
                          </button>
                          <button onClick={() => deleteItem(key, idx)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-md">
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Subtotal row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 items-center p-4 bg-gray-100 font-semibold text-gray-900">
                    <div className="sm:col-span-9 text-right">{label} Subtotal</div>
                    <div className="sm:col-span-1 text-right">{money(subBudget)}</div>
                    <div className="sm:col-span-1 text-right">{money(subActual)}</div>
                    <div className="sm:col-span-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* suggestions (optional) */}
      {showSuggestions && (
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
            <button onClick={() => setShowDetails((s) => !s)} className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 rounded-md">
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showDetails ? "Hide" : "Show"} Details
            </button>
          </div>
          <p className="text-sm text-gray-600">Your budget looks well optimized!</p>
        </div>
      )}

      <Toasts toasts={toasts} onClose={(id)=>removeToast(id)} onUndo={(t)=>{ t.onUndo?.(); removeToast(t.id); }} />
    </div>
  );
}
