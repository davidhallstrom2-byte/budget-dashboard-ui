// src/components/common/PageContainer.jsx
import React from "react";

/**
 * Centers content and caps the readable width so all tabs match.
 * Use surfaceClassName when a tab needs a full-width background behind
 * the centered content area.
 */
export default function PageContainer({
  children,
  className = "",
  surfaceClassName = "",
}) {
  const content = (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );

  if (!surfaceClassName) return content;

  return <div className={`w-full ${surfaceClassName}`}>{content}</div>;
}
