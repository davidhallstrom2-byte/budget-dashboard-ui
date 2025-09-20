import React from "react";
import { exportStateToFile, importStateFromFile } from "/src/utils/jsonIO.js";

export default function Toolbar({ tabs, activeTab, setActiveTab, onOpenBackups, onAddItem }) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl flex items-center gap-3 p-3">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              className={`rounded-full px-3 py-1 text-sm border ${
                activeTab === t ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Export / Import */}
        <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={exportStateToFile}>
          Export JSON
        </button>
        <button
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={importStateFromFile}
          title="Import full state or items list"
        >
          Import JSON
        </button>

        {/* Backups */}
        <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={onOpenBackups}>
          Backups…
        </button>

        {/* Scan Receipt */}
        <button
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => {
            setActiveTab("Editor");
            window.dispatchEvent(new Event("bd:scan"));
          }}
        >
          Scan Receipt
        </button>

        {/* Add Item */}
        <button
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm"
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
