// src/components/common/StickyToolbar.jsx
import React, { useEffect, useRef } from "react";

/**
 * Sticky dashboard toolbar.
 *
 * On production, MobileAccessGate publishes the live cloud-session bar height
 * through --budget-session-bar-height. This toolbar uses that value as its
 * sticky top offset so the cloud bar and dashboard navigation remain stacked
 * together while scrolling.
 *
 * On local development there is no cloud-session bar, so the offset is 0.
 */
export default function StickyToolbar({
  children,
  bgTint = "",
  contentClassName = "",
}) {
  const toolbarRef = useRef(null);
  const hasCustomTint = Boolean(String(bgTint || "").trim());

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const toolbar = toolbarRef.current;

    const updateToolbarHeight = () => {
      const height = toolbar
        ? Math.ceil(toolbar.getBoundingClientRect().height)
        : 0;

      root.style.setProperty(
        "--budget-toolbar-height",
        `${Math.max(height, 0)}px`
      );
    };

    updateToolbarHeight();
    window.addEventListener("resize", updateToolbarHeight);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateToolbarHeight)
        : null;

    if (toolbar) {
      resizeObserver?.observe(toolbar);
    }

    return () => {
      window.removeEventListener("resize", updateToolbarHeight);
      resizeObserver?.disconnect();
      root.style.removeProperty("--budget-toolbar-height");
    };
  }, []);

  return (
    <div
      ref={toolbarRef}
      style={{ top: "var(--budget-session-bar-height, 0px)" }}
      className={[
        "sticky z-[90] w-full border-b backdrop-blur",
        hasCustomTint
          ? bgTint
          : "bg-white/80 supports-[backdrop-filter]:bg-white/60",
        hasCustomTint ? "border-slate-800 shadow-lg" : "shadow-sm",
      ].join(" ")}
      role="navigation"
      aria-label="Budget Dashboard toolbar"
    >
      <div
        className={
          contentClassName || "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        }
      >
        {children}
      </div>
    </div>
  );
}
