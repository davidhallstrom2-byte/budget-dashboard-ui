import React, { useMemo, useState } from 'react';
import { useBudgetState } from '../../utils/state.js';
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Upload,
  Download,
  RefreshCcw,
  ArchiveRestore,
} from 'lucide-react';

/**
 * EditorTab (modern look & compat)
 * - Restores rounded cards, soft shadows, zebra rows, icon buttons.
 * - Works with older backups that may not expose computeTotals in the selector.
 * - Uses only relative imports; no aliases.
 */

const bucketOrder = [
  'income',
  'housing',
  'transportation',
  'food',
  'personal',
  'homeOffice',
  'banking',
  'misc',
];

const bucketLabels = {
  income: 'Income',
  housing: 'Housing',
  transportation: 'Transportation',
  food: 'Food',
  personal: 'Personal',
  homeOffice: 'Home Office',
  banking: 'Banking & Credit',
  misc: 'Miscellaneous',
};

const keyForBucket = (bucket, i) => `${bucket}__${i}`;
const keyForRow = (bucket, row, i) =>
  `${bucket}__${row?.id ?? row?.category ?? 'row'}__${row?.dueDate ?? ''}__${i}`;

function toNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function sumEst(items) {
  return (items || []).reduce(
    (t, r) => t + toNumber(r.estBudget ?? r.estimated ?? r.amount ?? 0),
    0
  );
}

export default function EditorTab() {
  // Canonical slices (guard older backups with || [])
  const state = {
    income: useBudgetState((s) => s.income || []),
    housing: useBudgetState((s) => s.housing || []),
    transportation: useBudgetState((s) => s.transportation || []),
    food: useBudgetState((s) => s.food || []),
    personal: useBudgetState((s) => s.personal || []),
    homeOffice: useBudgetState((s) => s.homeOffice || []),
    banking: useBudgetState((s) => s.banking || []),
    misc: useBudgetState((s) => s.misc || []),
  };

  // Store helpers (optional-chain for very old backups)
  const addRow = useBudgetState((s) => s.addRow);
  const updateRow = useBudgetState((s) => s.updateRow);
  const removeRow = useBudgetState((s) => s.removeRow);
  const moveRow = useBudgetState((s) => s.moveRow);
  const archiveCurrent = useBudgetState((s) => s.archiveCurrent);
  const restoreArchive = useBudgetState((s) => s.restoreArchive);
  const importFromJson = useBudgetState((s) => s.importFromJson);
  const exportToJson = useBudgetState((s) => s.exportToJson);
  const reloadData = useBudgetState((s) => s.reloadData);

  // Totals (robust across backups)
  const totals = useMemo(() => {
    try {
      const fn = useBudgetState.getState().computeTotals;
      if (typeof fn === 'function') return fn();
    } catch {}
    const s = useBudgetState.getState();
    const income = sumEst(s.income);
    const expenses =
      sumEst(s.housing) +
      sumEst(s.transportation) +
      sumEst(s.food) +
      sumEst(s.personal) +
      sumEst(s.homeOffice) +
      sumEst(s.banking) +
      sumEst(s.misc);
    return { totalIncome: income, totalExpenses: expenses, netIncome: income - expenses };
  }, [
    state.income,
    state.housing,
    state.transportation,
    state.food,
    state.personal,
    state.homeOffice,
    state.banking,
    state.misc,
  ]);

  // Local UI
  const [newRow, setNewRow] = useState({ category: '', estBudget: '', dueDate: '' });
  const [activeBucket, setActiveBucket] = useState('housing');

  const fmt = (n) =>
    (typeof n === 'number' ? n : 0).toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });

  const onAdd = () => {
    if (!activeBucket) return;
    const payload = {
      category: newRow.category?.trim() || 'New Item',
      estBudget: toNumber(newRow.estBudget) || 0,
      dueDate: newRow.dueDate || '',
    };
    addRow?.(activeBucket, payload);
    setNewRow({ category: '', estBudget: '', dueDate: '' });
  };

  const onExport = () => {
    const blob = new Blob([exportToJson?.() || '{}'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    importFromJson?.(text);
  };

  const onReload = async () => {
    await reloadData?.({ mode: 'preferNonZero', requireIncome: true });
  };

  return (
    <div className="space-y-6">
      {/* Totals header (cards) */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl shadow-sm border p-5 bg-white">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="text-3xl font-semibold mt-1">{fmt(totals.totalIncome)}</div>
        </div>
        <div className="rounded-2xl shadow-sm border p-5 bg-white">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="text-3xl font-semibold mt-1">{fmt(totals.totalExpenses)}</div>
        </div>
        <div className="rounded-2xl shadow-sm border p-5 bg-white">
          <div className="text-sm text-gray-500">Net Income</div>
          <div className={`text-3xl font-semibold mt-1 ${totals.netIncome < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmt(totals.netIncome)}
          </div>
        </div>
      </div>

      {/* Quick add (modern panel) */}
      <div className="rounded-2xl shadow-sm border p-4 bg-white">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Bucket</label>
            <select
              className="w-full border rounded-xl p-2 focus:outline-none focus:ring"
              value={activeBucket}
              onChange={(e) => setActiveBucket(e.target.value)}
            >
              {bucketOrder.map((b, i) => (
                <option key={keyForBucket(b, i)} value={b}>
                  {bucketLabels[b]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Category</label>
            <input
              className="w-full border rounded-xl p-2 focus:outline-none focus:ring"
              value={newRow.category}
              onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))}
              placeholder="e.g., Rent"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm text-gray-600 mb-1">Estimated</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-xl p-2 focus:outline-none focus:ring"
              value={newRow.estBudget}
              onChange={(e) => setNewRow((r) => ({ ...r, estBudget: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="w-44">
            <label className="block text-sm text-gray-600 mb-1">Due Date</label>
            <input
              type="date"
              className="w-full border rounded-xl p-2 focus:outline-none focus:ring"
              value={newRow.dueDate}
              onChange={(e) => setNewRow((r) => ({ ...r, dueDate: e.target.value }))}
            />
          </div>
          <div className="w-32">
            <button
              onClick={onAdd}
              className="w-full rounded-2xl bg-black text-white px-4 py-2 hover:opacity-90 flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Buckets (cards with zebra table + icon actions) */}
      <div className="space-y-6">
        {bucketOrder.map((bucket, bucketIdx) => {
          const items = state[bucket] || [];
          const subtotal = fmt(sumEst(items));
          return (
            <section key={keyForBucket(bucket, bucketIdx)} className="rounded-2xl shadow-sm border bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="text-lg font-semibold">{bucketLabels[bucket]} <span className="text-gray-400">({items.length})</span></h3>
                <div className="text-sm text-gray-500">Subtotal: <span className="font-medium text-gray-700">{subtotal}</span></div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-gray-500 border-y">
                      <th className="py-2 pr-3 pl-4">Category</th>
                      <th className="py-2 pr-3">Estimated</th>
                      <th className="py-2 pr-3">Due Date</th>
                      <th className="py-2 pr-3 w-56">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr key={keyForRow(bucket, row, idx)} className="border-t even:bg-gray-50">
                        <td className="py-2 pr-3 pl-4">
                          <input
                            className="w-full border rounded-lg p-1 focus:outline-none focus:ring"
                            value={row.category ?? ''}
                            onChange={(e) => updateRow?.(bucket, idx, { category: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-40 border rounded-lg p-1 focus:outline-none focus:ring"
                            value={row.estBudget ?? row.estimated ?? row.amount ?? 0}
                            onChange={(e) => updateRow?.(bucket, idx, { estBudget: toNumber(e.target.value) })}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="date"
                            className="w-44 border rounded-lg p-1 focus:outline-none focus:ring"
                            value={row.dueDate ?? ''}
                            onChange={(e) => updateRow?.(bucket, idx, { dueDate: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            {bucketIdx > 0 && (
                              <button
                                onClick={() => moveRow?.(bucket, bucketOrder[bucketIdx - 1], idx)}
                                title="Move to previous bucket"
                                className="rounded-xl border px-2 py-1 hover:bg-gray-50 inline-flex items-center gap-1"
                              >
                                <ArrowLeft size={16} /> Prev
                              </button>
                            )}
                            {bucketIdx < bucketOrder.length - 1 && (
                              <button
                                onClick={() => moveRow?.(bucket, bucketOrder[bucketIdx + 1], idx)}
                                title="Move to next bucket"
                                className="rounded-xl border px-2 py-1 hover:bg-gray-50 inline-flex items-center gap-1"
                              >
                                Next <ArrowRight size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => removeRow?.(bucket, idx)}
                              title="Remove"
                              className="rounded-xl border px-2 py-1 hover:bg-gray-50 inline-flex items-center gap-1 text-red-600"
                            >
                              <Trash2 size={16} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {items.length === 0 && (
                      <tr>
                        <td className="py-6 text-gray-500 pl-4" colSpan={4}>
                          No items in this bucket.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="rounded-2xl shadow-sm border p-4 bg-white flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button
            className="rounded-2xl border px-4 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={() => archiveCurrent?.('Manual snapshot')}
            title="Archive snapshot"
          >
            <SaveIcon /> Archive snapshot
          </button>
          <button
            className="rounded-2xl border px-4 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={() => {
              const idx = prompt('Restore which archive index? (0 based)');
              if (idx !== null) restoreArchive?.(Number(idx));
            }}
            title="Restore from archive"
          >
            <ArchiveRestore size={16} /> Restore archive…
          </button>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-2xl border px-4 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={onExport}
            title="Export JSON"
          >
            <Download size={16} /> Export JSON
          </button>
          <label
            className="rounded-2xl border px-4 py-2 hover:bg-gray-50 cursor-pointer inline-flex items-center gap-2"
            title="Import JSON"
          >
            <Upload size={16} /> Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
          </label>
          <button
            className="rounded-2xl border px-4 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={onReload}
            title="Reload data (guarded)"
          >
            <RefreshCcw size={16} /> Reload data
          </button>
        </div>
      </div>
    </div>
  );
}

/* Tiny inline icon to avoid extra imports for a single glyph */
function SaveIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="inline-block">
      <path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM5 19V5h10v4h4v10H5z"/>
    </svg>
  );
}
