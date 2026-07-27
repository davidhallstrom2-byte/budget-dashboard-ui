import React from 'react';
import { X } from 'lucide-react';

export default function CloseScreenButton({
  onClick,
  disabled = false,
  className = '',
  label = 'Close Screen',
  title = 'Close this screen and return to the underlying tab',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-white bg-slate-950 px-3 py-2 text-sm font-black text-white shadow-lg ring-1 ring-slate-950 transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 print:hidden ${className}`}
    >
      <X className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
