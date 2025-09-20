// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\tabs\EditorTab.jsx
import React, { useEffect, useState } from "react";
import ReceiptScanner from "../receipts/ReceiptScanner.jsx";

/**
 * Props this component will honor (all optional except `data`):
 *  - data: { [categoryKey]: Array<item> }
 *  - onImportItems(items)
 *  - onUpdateItem(categoryKey, index, patch)
 *  - onDeleteItem(categoryKey, index)
 *  - onMarkPaid(categoryKey, index)
 *  - onArchiveItem(categoryKey, index)
 */

const ORDER = [
  "income",
  "housing",
  "transportation",
  "food",
  "personal",
  "homeOffice",
  "banking",
  "misc",
];

const LABEL = {
  income: "Income",
  housing: "Housing",
  transportation: "Transportation",
  food: "Food",
  personal: "Personal",
  homeOffice: "Home Office",
  banking: "Banking & Credit",
  misc: "Misc",
};

export default function EditorTab(props) {
  const { data = {} } = props;
  const [scannerOpen, setScannerOpen] = useState(false);

  // Open scanner on bd:scan event
  useEffect(() => {
    const onScan = () => setScannerOpen(true);
    window.addEventListener("bd:scan", onScan);
    return () => window.removeEventListener("bd:scan", onScan);
  }, []);

  // Merge items coming from the scanner (already normalized)
  const handleExtracted = (items) => {
    if (Array.isArray(items) && items.length) {
      if (typeof props.onImportItems === "function") {
        props.onImportItems(items);
      } else {
        window.dispatchEvent(new CustomEvent("bd:import-items", { detail: items }));
      }
    }
  };

  const sectionTotal = (arr) =>
    (arr || []).reduce((s, it) => s + Number(it.estBudget || 0), 0);

  const fmt = (n) =>
    (isFinite(n) ? Number(n) : 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const isOverdue = (due) => {
    if (!due) return false;
    const d = new Date(due);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return d < now;
  };

  return (
    <div className="p-4">
      <ReceiptScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDataExtracted={handleExtracted}
      />

      {ORDER.map((key) => {
        const items = data[key] || [];
        const total = sectionTotal(items);
        return (
          <div
            key={key}
            className="bg-white border rounded-xl mb-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">
                {LABEL[key] ?? key}
              </h2>
              <div className="text-sm text-gray-600">
                Total: <span className="font-semibold">${fmt(total)}</span>
              </div>
            </div>

            <div className="divide-y">
              {items.length === 0 ? (
                <div className="text-center text-gray-500 px-6 py-10">
                  No items yet.
                  <span className="ml-1">
                    Use <em>Scan Receipt</em>, <em>Upload Receipt</em>, or{" "}
                    <em>Manual Entry</em>.
                  </span>
                </div>
              ) : (
                items.map((it, idx) => {
                  const overdue = isOverdue(it.dueDate);
                  return (
                    <div
                      key={idx}
                      className={`px-5 py-4 ${overdue ? "bg-red-50/40" : "bg-white"}`}
                    >
                      {/* Responsive row: never overlaps */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 gap-y-3">
                        {/* Item name */}
                        <div className="md:col-span-5 min-w-0">
                          <input
                            className="w-full min-w-0 border rounded-md px-3 py-2 text-sm"
                            value={it.category ?? ""}
                            onChange={(e) =>
                              props.onUpdateItem?.(key, idx, {
                                category: e.target.value,
                              })
                            }
                            placeholder="Item name"
                          />
                        </div>

                        {/* Amount */}
                        <div className="grid grid-cols-1 md:col-span-2 min-w-0">
                          <input
                            type="number"
                            step="0.01"
                            className="w-full min-w-0 border rounded-md px-3 py-2 text-sm"
                            value={it.estBudget ?? 0}
                            onChange={(e) =>
                              props.onUpdateItem?.(key, idx, {
                                estBudget: Number(e.target.value || 0),
                              })
                            }
                            placeholder="0.00"
                          />
                        </div>

                        {/* Due date */}
                        <div className="grid grid-cols-1 md:col-span-3 min-w-0">
                          <input
                            type="date"
                            className={`w-full min-w-0 md:min-w-[180px] border rounded-md px-3 py-2 text-sm ${
                              overdue ? "bg-red-50 border-red-300 text-red-700" : ""
                            }`}
                            value={it.dueDate ?? ""}
                            onChange={(e) =>
                              props.onUpdateItem?.(key, idx, {
                                dueDate: e.target.value,
                              })
                            }
                          />
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-2 col-span-1 flex flex-wrap gap-2 justify-end md:items-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-md self-center shrink-0 ${
                              it.bankSource === "Paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {it.bankSource === "Paid" ? "Paid" : "Pending"}
                          </span>

                          <button
                            className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200"
                            onClick={() => props.onMarkPaid?.(key, idx)}
                          >
                            Mark Paid
                          </button>

                          <button
                            className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
                            onClick={() => props.onArchiveItem?.(key, idx)}
                          >
                            Archive
                          </button>

                          <button
                            className="px-2 py-1 text-xs rounded-md bg-red-100 text-red-800 hover:bg-red-200"
                            onClick={() => props.onDeleteItem?.(key, idx)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
