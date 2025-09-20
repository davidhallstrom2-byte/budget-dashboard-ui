// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\receipts\ReceiptScanner.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * ReceiptScanner
 * - Shows a modal with Choose File / Mock Extract / Close.
 * - DOES NOT add any items until the user explicitly selects a file
 *   or presses "Mock Extract".
 *
 * Props:
 *   open               : boolean
 *   onClose            : () => void
 *   onDataExtracted    : (items: Array<NormalizedItem>) => void
 */
export default function ReceiptScanner({ open, onClose, onDataExtracted }) {
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handlePick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return; // user canceled
    setBusy(true);
    try {
      // Prefer JSX adapter, fall back to JS shim
      let mod;
      try {
        mod = await import("../../utils/ocr/index.jsx");
      } catch {
        mod = await import("../../utils/ocr/index.js");
      }
      const result = await mod.extractFromFile(file);
      if (result && Array.isArray(result.items) && result.items.length) {
        onDataExtracted(result.items);
      }
      onClose();
    } catch (err) {
      console.error("[Scanner] extractFromFile failed:", err);
      // No placeholder row on error; user can try again or mock
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMockExtract = () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const items = [
      {
        categoryKey: "misc",
        categoryLabel: "Misc",
        category: "Scanned Item",
        estBudget: 0,
        dueDate: todayISO,
        bankSource: "Pending",
      },
    ];
    onDataExtracted(items);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => (busy ? null : onClose())}
        aria-hidden="true"
      />
      <div className="relative z-10 w-[min(94vw,700px)] rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Receipt Scanner</h2>
          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            title="Close"
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Choose a receipt image or PDF to extract line items, or click{" "}
          <strong>Mock Extract</strong> to test.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePick}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Reading…" : "Choose File"}
          </button>

          <button
            type="button"
            onClick={handleMockExtract}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={busy}
          >
            Mock Extract
          </button>

          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            className="rounded-md bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
            disabled={busy}
          >
            Close
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
