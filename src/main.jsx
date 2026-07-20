import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";               // <-- THIS LINE is required
import App from "./App.jsx";        // or wherever you mount BudgetDashboard

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/budget-dashboard-fs/sw.js", {
      scope: "/budget-dashboard-fs/",
    }).catch((error) => {
      console.warn("Mobile app installation support could not start.", error);
    });
  });
}
