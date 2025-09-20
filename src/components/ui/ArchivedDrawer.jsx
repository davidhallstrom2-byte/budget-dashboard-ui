// src/components/ui/ArchivedDrawer.jsx
import React from "react";
import { X, ArchiveRestore } from "lucide-react";

export default function ArchivedDrawer({ open, onClose, archivedList, onUnarchive, onDelete }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 border-l shadow-xl z-[61] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Archived Items ({archivedList.length})</h4>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 overflow-auto space-y-3">
          {archivedList.length === 0 && <p className="text-sm text-gray-600">No archived items.</p>}
          {archivedList.map(({ cat, idx, item, label }, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.category}</p>
                  <p className="text-xs text-gray-500">{label}{item.dueDate ? ` â€¢ Due ${item.dueDate}` : ""}</p>
                </div>
                <div className="text-right font-semibold">${(item.estBudget || 0).toFixed(2)}</div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => onUnarchive(cat, idx)} className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                  <ArchiveRestore className="inline h-3 w-3 mr-1" /> Unarchive
                </button>
                <button onClick={() => onDelete(cat, idx)} className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


