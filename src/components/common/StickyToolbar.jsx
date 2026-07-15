// src/components/common/StickyToolbar.jsx
import React from "react";

/**
 * Sticky, translucent toolbar that pins to the viewport top.
 * Pass a Tailwind bg tint (e.g., "bg-blue-100") to match the active tab.
 * Centers content to the same width as PageContainer (max-w-6xl).
 */
export default function StickyToolbar({ children, bgTint = "", contentClassName = "" }) {
  const hasCustomTint = Boolean(String(bgTint || "").trim());

  return (
    <div
      className={[
        "sticky top-0 z-50 w-full border-b backdrop-blur",
        hasCustomTint ? bgTint : "bg-white/80 supports-[backdrop-filter]:bg-white/60",
        hasCustomTint ? "border-slate-800 shadow-lg" : "shadow-sm",
      ].join(" ")}
      role="navigation"
      aria-label="Budget Dashboard toolbar"
    >
      {/* Match PageContainer width (adjust if you changed PageContainer's max width) */}
      <div className={contentClassName || "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"}>
        {children}
      </div>
    </div>
  );
}
