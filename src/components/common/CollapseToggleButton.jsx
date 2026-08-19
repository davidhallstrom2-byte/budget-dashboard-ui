import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const COLLAPSE_TOGGLE_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50';

export default function CollapseToggleButton({
  action,
  expanded,
  onClick,
  title,
  ariaLabel,
  className = '',
  disabled = false,
  controls,
}) {
  const collapseAction = action ? action === 'collapse' : Boolean(expanded);
  const tooltip = title || (collapseAction ? 'Collapse' : 'Expand');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={ariaLabel || tooltip}
      aria-expanded={typeof expanded === 'boolean' ? expanded : undefined}
      aria-controls={controls}
      className={`${COLLAPSE_TOGGLE_CLASS} ${className}`}
    >
      {collapseAction ? (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
