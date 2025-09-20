// src/components/tabs/DashboardTab.jsx
import React from "react";
import ModernBudgetPanel from "../modern/ModernBudgetPanel.jsx";
export default function DashboardTab({ state, setState }) {
  return <ModernBudgetPanel state={state} setState={setState} showSuggestions />;
}
