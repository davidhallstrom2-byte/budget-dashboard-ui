import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// App entry (renders your dashboard)
import BudgetDashboard from './components/BudgetDashboard.jsx';

// DB-primary mode (per your spec)
globalThis.BUDGET_STORAGE_MODE = "db";
globalThis.BUDGET_API_BASE = "/wp-json/budget/v1";

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BudgetDashboard />
  </React.StrictMode>
);
