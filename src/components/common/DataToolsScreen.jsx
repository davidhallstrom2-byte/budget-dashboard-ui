import React, { useEffect, useRef } from "react";
import CloseScreenButton from "./CloseScreenButton.jsx";

const TONE_CLASSES = {
  sky: {
    card: "border-sky-200 bg-sky-50",
    icon: "text-sky-800",
    button: "bg-sky-800 hover:bg-sky-900 focus-visible:ring-sky-700",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50",
    icon: "text-indigo-800",
    button: "bg-indigo-800 hover:bg-indigo-900 focus-visible:ring-indigo-700",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-800",
    button: "bg-emerald-800 hover:bg-emerald-900 focus-visible:ring-emerald-700",
  },
  violet: {
    card: "border-violet-200 bg-violet-50",
    icon: "text-violet-800",
    button: "bg-violet-800 hover:bg-violet-900 focus-visible:ring-violet-700",
  },
  amber: {
    card: "border-amber-200 bg-amber-50",
    icon: "text-amber-800",
    button: "bg-amber-800 hover:bg-amber-900 focus-visible:ring-amber-700",
  },
};

export default function DataToolsScreen({ title, subtitle, onClose, tools = [] }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = `data-tools-${String(title || "data").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const subtitleId = `${titleId}-description`;

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeRef.current?.();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement instanceof HTMLElement && previouslyFocusedElement.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9998]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
        aria-label={`Close ${title}`}
        tabIndex={-1}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-[52rem] flex-col bg-white shadow-2xl"
      >
        <header className="flex min-h-[78px] items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="break-words text-lg font-black leading-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className="mt-1 max-w-[60ch] break-words text-xs leading-5 text-slate-600 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">
            <CloseScreenButton onClick={onClose} />
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="mx-auto grid w-full max-w-[46rem] gap-4 sm:grid-cols-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const tone = TONE_CLASSES[tool.tone] || TONE_CLASSES.sky;

              return (
                <section
                  key={tool.key || tool.title}
                  className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${tone.card} ${tool.wide ? "sm:col-span-2" : ""}`}
                >
                  {Icon ? <Icon className={`h-6 w-6 ${tone.icon}`} aria-hidden="true" /> : null}
                  <h3 className="mt-3 text-base font-black text-slate-950">{tool.title}</h3>
                  <p className="mt-1 max-w-[60ch] break-words text-sm leading-6 text-slate-700">{tool.description}</p>
                  <button
                    type="button"
                    onClick={tool.onClick}
                    title={tool.buttonTitle || tool.buttonLabel}
                    className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tone.button} ${tool.fullWidth === false ? "" : "w-full"}`}
                  >
                    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                    {tool.buttonLabel}
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
