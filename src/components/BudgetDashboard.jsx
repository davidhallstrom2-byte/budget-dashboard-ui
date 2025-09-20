import React, { useEffect, useState } from "react";
import Toolbar from "./ui/Toolbar.jsx";
import AnalysisTab from "./tabs/AnalysisTab.jsx";
import CalculatorTab from "./tabs/CalculatorTab.jsx";
import EditorTab from "./tabs/EditorTab.jsx";

// Store
import { subscribe, hydrate } from "/src/utils/state.js";

// 🔹 Modern “bridge” that adapts canonical state to your ModernBudgetPanel
import ModernBridge from "/src/components/modern/ModernBridge.jsx";

const TABS = ["Dashboard", "Analysis", "Calculator", "Editor"];

export default function BudgetDashboard() {
  const [appState, setAppState] = useState(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showBackups, setShowBackups] = useState(false);

  useEffect(() => {
    const un = subscribe(setAppState);
    hydrate();
    return () => un();
  }, []);

  useEffect(() => {
    const open = () => setShowBackups(true);
    window.addEventListener("bd:open-backups", open);
    return () => window.removeEventListener("bd:open-backups", open);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toolbar
        tabs={TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBackups={() => setShowBackups(true)}
        onAddItem={() => {
          setActiveTab("Editor");
          window.dispatchEvent(new Event("bd:add-item"));
        }}
      />

      <div className="mx-auto w-full max-w-6xl p-4">
        {activeTab === "Dashboard" && <DashboardTab state={appState} />}

        {activeTab === "Analysis" && <AnalysisTab state={appState} />}
        {activeTab === "Calculator" && <CalculatorTab state={appState} />}
        {activeTab === "Editor" && <EditorTab state={appState} />}
      </div>

      {showBackups && <div className="hidden" />}{/* placeholder for your Backups modal */}
    </div>
  );
}

function DashboardTab({ state }) {
  if (!state) return <div className="text-sm text-gray-500">Loading…</div>;

  const bd = state.budgetData || {};
  const order = Array.isArray(state?.ui?.sections) ? state.ui.sections : Object.keys(bd);

  return (
    <>
      {/* 🔹 Modern panel (bridged) */}
      <div className="mb-6">
        <ModernBridge state={state} setState={() => { /* bridge commits itself */ }} />
      </div>

      {/* Optional divider; keep classic tables below */}
      <div className="my-4 h-px bg-gray-200" />

      {/* Classic tables */}
      {order.map((key) => {
        const arr = Array.isArray(bd[key]) ? bd[key] : [];
        const title = (state?.ui?.labels?.[key]) || key.replace(/^[a-z]/, c => c.toUpperCase());
        const total = arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        return (
          <div key={key} className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{title}</h3>
              <div className="text-sm font-medium">${total.toFixed(2)}</div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2 text-left">Amount</th>
                    <th className="border p-2 text-left">Due</th>
                    <th className="border p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {arr.length === 0 ? (
                    <tr><td colSpan={4} className="border p-2 text-gray-500">No items</td></tr>
                  ) : arr.map((r, i) => (
                    <tr key={r?.id ?? `${key}-${i}`}>
                      <td className="border p-2">{r?.name ?? ""}</td>
                      <td className="border p-2">${Number(r?.amount || 0).toFixed(2)}</td>
                      <td className="border p-2">{r?.dueDate || r?.date || ""}</td>
                      <td className="border p-2">{r?.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
