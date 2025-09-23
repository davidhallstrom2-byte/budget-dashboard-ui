import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";               // <-- THIS LINE is required
import App from "./App.jsx";        // or wherever you mount BudgetDashboard

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
