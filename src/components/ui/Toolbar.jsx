import React from "react";
import { exportStateToFile, importStateFromFile } from "/src/utils/jsonIO.js";

export default function Toolbar({ tabs, activeTab, setActiveTab, onOpenBackups, onAddItem }) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      {/* Reserve vertical space so nothing jumps on activation */}
      <div className="mx-auto max-w-6xl flex items-center gap-3 px-3 py-3 min-h-14">
        {/* Tabs */}
        <div className="flex items-center gap-2" role="tablist" aria-label="Budget tabs">
          {tabs.map((t) => {
            const isActive = activeTab === t;

            // Strict, CLS-safe base: fixed height, line-height, border width, padding, font weight.
            // Also lock box sizing and remove any focus rings that change box metrics.
            const base =
              "inline-flex items-center justify-center " +
              "rounded-2xl h-9 min-w-[92px] px-4 " + // <- min width neutralizes tiny kerning/antialias shifts
              "text-sm font-medium leading-[1.125rem] tracking-normal " +
              "border border-solid box-border " +
              "whitespace-nowrap select-none " +
              "outline-none ring-0 focus:outline-none focus:ring-0 " +
              "transition-colors"; // colors only, no size/spacing transitions

            const activeCls = "bg-gray-900 text-white border-gray-900";
            const inactiveCls = "bg-white text-gray-800 border-gray-300 hover:bg-gray-50";

            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${t}`}
                onClick={() => setActiveTab(t)}
                className={`${base} ${isActive ? activeCls : inactiveCls}`}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Export / Import */}
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 text-sm font-medium leading-[1.125rem] tracking-normal text-gray-800 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus:ring-0"
          onClick={exportStateToFile}
        >
          Export JSON
        </button>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 text-sm font-medium leading-[1.125rem] tracking-normal text-gray-800 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus:ring-0"
          onClick={importStateFromFile}
          title="Import full state or items list"
        >
          Import JSON
        </button>

        {/* Backups */}
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 text-sm font-medium leading-[1.125rem] tracking-normal text-gray-800 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus:ring-0"
          onClick={onOpenBackups}
        >
          Backups…
        </button>

        {/* Scan Receipt */}
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 text-sm font-medium leading-[1.125rem] tracking-normal text-gray-800 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus:ring-0"
          onClick={() => {
            setActiveTab("Editor");
            window.dispatchEvent(new Event("bd:scan"));
          }}
        >
          Scan Receipt
        </button>

        {/* Add Item */}
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-2xl px-4 text-sm font-medium leading-[1.125rem] tracking-normal bg-blue-600 text-white hover:brightness-95 transition-colors outline-none focus:outline-none focus:ring-0"
          onClick={() => {
            if (typeof onAddItem === "function") onAddItem();
            else {
              setActiveTab("Editor");
              window.dispatchEvent(new Event("bd:add-item"));
            }
          }}
        >
          + Add Item
        </button>
      </div>
    </div>
  );
}
