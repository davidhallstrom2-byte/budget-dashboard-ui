// src/components/tabs/DashboardTab.jsx
import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, DollarSign, TrendingUp, TrendingDown, Download, AlertTriangle } from "lucide-react";

const printableHtml = ({ rows, totalsByCategory, totals }) => {
  const style = `
  *{box-sizing:border-box} body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial;color:#111827;background:#fff;margin:24px}
  h1{font-size:20px;margin:0 0 8px} .muted{color:#6b7280}
  table{width:100%;border-collapse:collapse;margin:12px 0 24px}
  th,td{padding:10px 12px;font-size:12px;border-bottom:1px solid #e5e7eb}
  thead th{background:#f9fafb;text-align:left;color:#374151}
  .right{text-align:right} .pill{padding:2px 8px;border-radius:9999px;border:1px solid #e5e7eb;font-size:11px;display:inline-block}`;
  const bodyRows = rows.map(r => `
  <tr>
    <td>${r.name}</td><td>${r.sectionLabel}</td><td class="muted">${r.dueDate || ""}</td>
    <td class="right">$${r.estBudget.toFixed(2)}</td><td class="right">$${r.actualSpent.toFixed(2)}</td>
    <td><span class="pill">${r.status}</span></td>
  </tr>`).join("");

  const subtotals = Object.entries(totalsByCategory).map(([label, t]) => `
  <tr>
    <td colspan="2"></td>
    <td class="right"><strong>${label} subtotal</strong></td>
    <td class="right"><strong>$${t.budget.toFixed(2)}</strong></td>
    <td class="right"><strong>$${t.actual.toFixed(2)}</strong></td>
    <td></td>
  </tr>`).join("");

  const grand = `
  <tr>
    <td colspan="3" class="right"><strong>Grand totals</strong></td>
    <td class="right"><strong>$${totals.totalExpenses.toFixed(2)}</strong></td>
    <td class="right"><strong>$${totals.totalIncome.toFixed(2)}</strong></td>
    <td></td>
  </tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Budget List</title><style>${style}</style></head>
  <body><h1>Budget List</h1><div class="muted">Printer friendly view</div>
  <table><thead><tr><th>Item</th><th>Section</th><th>Due</th><th class="right">Budget</th><th class="right">Actual</th><th>Status</th></tr></thead>
  <tbody>${bodyRows}${subtotals}${grand}</tbody></table></body></html>`;
};

export default function DashboardTab({ totals, pieData, upcoming, flatRows, totalsByCategory }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-600">Total Income</p>
              <p className="text-2xl font-bold text-blue-900">${totals.totalIncome.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-red-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900">${totals.totalExpenses.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className={`${totals.netIncome >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} p-6 rounded-2xl border shadow-sm`}>
          <div className="flex items-center">
            {totals.netIncome >= 0 ? <TrendingUp className="h-8 w-8 text-green-600" /> : <TrendingDown className="h-8 w-8 text-red-600" />}
            <div className="ml-4">
              <p className={`text-sm font-medium ${totals.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>Net Income</p>
              <p className={`text-2xl font-bold ${totals.netIncome >= 0 ? "text-green-900" : "text-red-900"}`}>${totals.netIncome.toFixed(2)}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={110} dataKey="value"
                   label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => {
                  const pal = ["#60a5fa","#f97316","#10b981","#f43f5e","#8b5cf6","#06b6d4","#f59e0b","#9ca3af"];
                  return <Cell key={i} fill={pal[i % pal.length]} />;
                })}
              </Pie>
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Upcoming Payments</h3>
          <div className="space-y-3 max-h-[300px] overflow-auto pr-1">
            {upcoming.length === 0 && <p className="text-sm text-gray-600">Nothing upcoming in the next few weeks.</p>}
            {upcoming.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border">
                <div>
                  <p className="font-medium">
                    {p.name} <span className="text-xs text-gray-500">({p.category})</span>
                  </p>
                  <p className="text-xs text-gray-600">{p.dueDate}</p>
                  <p className="text-xs font-medium">
                    {p.daysUntilDue === 0 ? "Due Today" : p.daysUntilDue === 1 ? "Due Tomorrow" : `Due in ${p.daysUntilDue} days`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${p.estBudget.toFixed(2)}</p>
                  {p.priority === "high" && <AlertTriangle className="h-4 w-4 text-red-500 inline" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Budget List</h3>
          <button
            type="button"
            onClick={() => {
              const html = printableHtml({ rows: flatRows, totalsByCategory, totals });
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "budget-list-print.html";
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Download print view
          </button>
        </div>

        <div className="grid grid-cols-12 text-xs font-semibold text-gray-600 border-b pb-2">
          <div className="col-span-4">Item</div>
          <div className="col-span-3">Section</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-1 text-right">Budget</div>
          <div className="col-span-1 text-right">Actual</div>
          <div className="col-span-1 text-right">Status</div>
        </div>

        <div className="mt-2 space-y-6">
          {["income","housing","transportation","food","personal","homeOffice","banking","misc"].map((key) => {
            const group = flatRows.filter((r) => r.section === key);
            if (group.length === 0) return null;
            const subtotalBudget = group.reduce((s, r) => s + r.estBudget, 0);
            const subtotalActual = group.reduce((s, r) => s + r.actualSpent, 0);
            const label = key === "homeOffice" ? "Home Office" : key.charAt(0).toUpperCase() + key.slice(1);

            return (
              <div key={key}>
                <div className="mb-1 text-sm font-semibold text-gray-900">{label}</div>
                <div className="divide-y rounded-xl border">
                  {group.map((r, i) => {
                    const days = r.dueDate ? Math.ceil((new Date(r.dueDate) - new Date()) / (1000*60*60*24)) : null;
                    const paidTint = r.status === "Paid" ? "bg-green-50" : "";
                    const overdueTint = r.status !== "Paid" && days != null && days <= 0 ? "bg-red-50" : "";
                    const dueSoonTint = r.status !== "Paid" && overdueTint === "" && days != null && days <= 3 ? "bg-amber-50" : "";
                    const rowClass = paidTint || overdueTint || dueSoonTint;

                    return (
                      <div key={i} className={`grid grid-cols-12 items-center p-3 ${rowClass}`}>
                        <div className="col-span-4">{r.name}</div>
                        <div className="col-span-3 text-gray-700">{r.sectionLabel}</div>
                        <div className="col-span-2 text-gray-600 text-sm">{r.dueDate || ""}</div>
                        <div className="col-span-1 text-right font-medium">${r.estBudget.toFixed(2)}</div>
                        <div className="col-span-1 text-right">${r.actualSpent.toFixed(2)}</div>
                        <div className="col-span-1 text-right">
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${ 
                            r.status === "Paid" ? "bg-green-50 border-green-200 text-green-700"
                            : r.status === "Partial" ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-gray-50 border-gray-200 text-gray-700" 
                          }`}>{r.status}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-12 items-center p-3 bg-gray-50">
                    <div className="col-span-9 text-right font-semibold">Subtotal</div>
                    <div className="col-span-1 text-right font-semibold">${subtotalBudget.toFixed(2)}</div>
                    <div className="col-span-1 text-right font-semibold">${subtotalActual.toFixed(2)}</div>
                    <div className="col-span-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-12 items-center p-3 rounded-xl bg-blue-50 border border-blue-200">
          <div className="col-span-9 text-right font-semibold text-blue-800">Grand totals</div>
          <div className="col-span-1 text-right font-semibold text-blue-800">${totals.totalExpenses.toFixed(2)}</div>
          <div className="col-span-1 text-right font-semibold text-blue-800">${totals.totalIncome.toFixed(2)}</div>
          <div className="col-span-1" />
        </div>
      </div>
    </div>
  );
}


