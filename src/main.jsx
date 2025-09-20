import React from "react";
import { createRoot } from "react-dom/client";

// Side-effect import so the store's bd:* listeners are mounted at boot.
import "/src/utils/state.js";

import BudgetDashboard from "/src/components/BudgetDashboard.jsx";
import "/src/index.css";

// Harmless in dev; used in WP build mode.
globalThis.BUDGET_STORAGE_MODE = "db";
globalThis.BUDGET_API_BASE = "/wp-json/budget/v1";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BudgetDashboard />
  </React.StrictMode>
);
