// src/App.jsx
import React from "react";
import BudgetDashboard from "./components/BudgetDashboard.jsx";
import MobileAccessGate from "./mobile/MobileAccessGate.jsx";

export default function App() {
  return (
    <MobileAccessGate>
      <BudgetDashboard />
    </MobileAccessGate>
  );
}
