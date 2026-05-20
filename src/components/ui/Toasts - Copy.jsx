// src/components/ui/Toasts.jsx
import React from "react";

export default function Toasts({ toasts, onUndo, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-[70]">
      {toasts.map((t) => (
        <div key={t.id} className="bg-white rounded-xl border shadow px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-gray-900">{t.message}</span>
          {t.onUndo && (
            <button onClick={() => onUndo(t)} className="text-blue-700 text-sm font-medium hover:underline">
              Undo
            </button>
          )}
          <button onClick={() => onClose(t.id)} className="text-gray-500 text-xs ml-2">×</button>
        </div>
      ))}
    </div>
  );
}
