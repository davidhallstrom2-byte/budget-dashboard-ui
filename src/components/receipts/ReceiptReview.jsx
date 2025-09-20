import React, { useMemo, useState } from "react";
import { CATEGORY_OPTIONS } from "../../utils/receipts/vendors";

export default function ReceiptReview({ seed, onCancel, onConfirm }) {
  const [categoryKey, setCategoryKey] = useState(seed.categoryKey || "misc");
  const [label, setLabel] = useState(seed.vendorLabel || "");
  const [amount, setAmount] = useState(seed.amount ?? 0);
  const [dateISO, setDateISO] = useState(seed.dateISO || new Date().toISOString().slice(0, 10));

  const valid = useMemo(
    () => categoryKey && label.trim().length > 0 && Number.isFinite(+amount),
    [categoryKey, label, amount]
  );

  const handleSave = () => {
    if (!valid) return;
    onConfirm?.({
      categoryKey,
      item: {
        category: label.trim(),
        estBudget: Math.max(0, parseFloat(amount) || 0),
        actualSpent: 0,
        dueDate: dateISO,
        bankSource: "Upcoming",
        archived: false
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Review Receipt</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={categoryKey}
              onChange={e => setCategoryKey(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Item Name</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Vendor / Description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={dateISO}
              onChange={e => setDateISO(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-2 rounded bg-gray-100">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!valid}
            className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            Add to Budget
          </button>
        </div>
      </div>
    </div>
  );
}
