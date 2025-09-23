// src/components/BudgetDashboard.jsx
// Tab router with Dashboard, Analysis, Calculator, and Editor.
// CLS-safe tabs; Analysis content is provided by tabs/AnalysisTab.jsx.
// Global scrollbar space should be reserved in index.css.

import React, { useState } from "react";
import LoadingGate from "./common/LoadingGate";
import ModernBudgetPanel from "./modern/ModernBudgetPanel";
import EditorTab from "./tabs/EditorTab";
import AnalysisTab from "./tabs/AnalysisTab";
import { useBudgetState } from "../utils/state";

import { DollarSign, TrendingUp, Calculator as CalcIcon, Plus } from "lucide-react";

function TabButton({ id, label, active, onClick }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl h-9 min-w-[92px] px-4 text-sm font-medium leading-[1.125rem] tracking-normal border border-solid box-border whitespace-nowrap select-none outline-none ring-0 focus:outline-none focus:ring-0 transition-colors";
  const activeCls = "bg-gray-900 text-white border-gray-900";
  const inactiveCls = "bg-white text-gray-800 border-gray-300 hover:bg-gray-50";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      onClick={onClick}
      className={`${base} ${active ? activeCls : inactiveCls}`}
    >
      {label}
    </button>
  );
}

export default function BudgetDashboard() {
  const [tab, setTab] = useState("modern"); // modern | analysis | calculator | editor
  const [asOfDate, setAsOfDate] = useState("2025-09-01");

  const reloadData = useBudgetState((s) => s.reloadData);
  const loading = useBudgetState((s) => s.meta.loading);
  const hydrated = useBudgetState((s) => s.meta.hydrated);

  const tabs = [
    { id: "modern", label: "Dashboard", icon: DollarSign },
    { id: "analysis", label: "Analysis", icon: TrendingUp },
    { id: "calculator", label: "Calculator", icon: CalcIcon },
    { id: "editor", label: "Editor", icon: Plus },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Budget tabs" className="flex items-center gap-2">
          {tabs.map((t) => (
            <TabButton key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">As of</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="button"
            onClick={reloadData}
            disabled={loading}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
              loading
                ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400"
                : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
            title="Reload budget data from DB or restore file"
          >
            {loading ? "Reloading…" : hydrated ? "Reload data" : "Load data"}
          </button>
        </div>
      </div>

      {/* Panels */}
      <LoadingGate>
        <div id="panels" className="rounded-xl">
          {/* Dashboard */}
<section id="panel-modern" role="tabpanel" hidden={tab !== "modern"} aria-labelledby="modern">
  {tab === "modern" ? <ModernBudgetPanel asOfDate={asOfDate} /> : null}
</section>

          {/* Analysis */}
          <section id="panel-analysis" role="tabpanel" hidden={tab !== "analysis"} aria-labelledby="analysis">
            {tab === "analysis" ? <AnalysisTab asOfDate={asOfDate} /> : null}
          </section>

          {/* Calculator */}
          <section id="panel-calculator" role="tabpanel" hidden={tab !== "calculator"} aria-labelledby="calculator">
            {tab === "calculator" ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg border shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Income Calculator</h3>
                  <p className="text-sm text-gray-600">
                    Use the Analysis tab for detailed charts and suggestions. Calculator features coming soon.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          {/* Editor */}
          <section id="panel-editor" role="tabpanel" hidden={tab !== "editor"} aria-labelledby="editor">
            {tab === "editor" ? <EditorTab /> : null}
          </section>
        </div>
      </LoadingGate>
    </div>
  );
}
