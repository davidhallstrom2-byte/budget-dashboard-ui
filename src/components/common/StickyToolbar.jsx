// src/components/common/StickyToolbar.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Sticky, translucent toolbar that pins to the viewport top.
 * Pass a Tailwind bg tint (e.g., "bg-blue-100") to match the active tab.
 * Centers content to the same width as PageContainer (max-w-6xl).
 */
export default function StickyToolbar({ children, bgTint = "", contentClassName = "" }) {
  const hasCustomTint = Boolean(String(bgTint || "").trim());
  const toolbarRef = useRef(null);
  const [desktopTopOffset, setDesktopTopOffset] = useState(0);
  const [desktopToolbarHeight, setDesktopToolbarHeight] = useState(0);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof window === "undefined") return undefined;

    const dashboardRoot = toolbar.parentElement;
    const sessionBar = dashboardRoot?.previousElementSibling;
    const desktopQuery = window.matchMedia("(min-width: 1280px)");

    const updateDesktopTopOffset = () => {
      if (!desktopQuery.matches || !(sessionBar instanceof HTMLElement)) {
        setDesktopTopOffset(0);
        setDesktopToolbarHeight(
          desktopQuery.matches ? Math.ceil(toolbar.getBoundingClientRect().height) : 0
        );
        return;
      }

      const sessionBarStyles = window.getComputedStyle(sessionBar);
      const isVisible =
        sessionBarStyles.display !== "none" &&
        sessionBarStyles.visibility !== "hidden";

      setDesktopTopOffset(
        isVisible ? Math.ceil(sessionBar.getBoundingClientRect().height) : 0
      );
      setDesktopToolbarHeight(Math.ceil(toolbar.getBoundingClientRect().height));
    };

    updateDesktopTopOffset();
    window.addEventListener("resize", updateDesktopTopOffset);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateDesktopTopOffset)
        : null;

    resizeObserver?.observe(toolbar);
    if (sessionBar instanceof HTMLElement) {
      resizeObserver?.observe(sessionBar);
    }

    return () => {
      window.removeEventListener("resize", updateDesktopTopOffset);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <>
      <div
        className="hidden xl:block"
        style={{ height: `${desktopToolbarHeight}px` }}
        aria-hidden="true"
      />

      <div
        ref={toolbarRef}
        style={{ top: `${desktopTopOffset}px` }}
        className={[
          "sticky z-30 w-full border-b backdrop-blur xl:fixed xl:inset-x-0 xl:z-30",
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
    </>
  );
}
