// src/components/common/PageContainer.jsx
import React from "react";

/**
 * Centers content and caps the readable width so all tabs match.
 * Adjust max-w-6xl if your EditorTab uses a different width (e.g., max-w-5xl/7xl).
 */
export default function PageContainer({ children, className = "" }) {
  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
