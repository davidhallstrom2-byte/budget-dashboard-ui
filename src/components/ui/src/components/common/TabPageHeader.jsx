// src/components/common/TabPageHeader.jsx
import React from 'react';

const THEME_CLASSES = {
  blue: {
    shell: 'border-blue-500 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-700 shadow-blue-300/40',
    icon: 'bg-white/15 text-blue-100 ring-white/20',
    subtitle: 'text-blue-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  cyan: {
    shell: 'border-cyan-500 bg-gradient-to-r from-cyan-900 via-cyan-700 to-blue-700 shadow-cyan-300/40',
    icon: 'bg-white/15 text-cyan-100 ring-white/20',
    subtitle: 'text-cyan-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  emerald: {
    shell: 'border-emerald-500 bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 shadow-emerald-300/40',
    icon: 'bg-white/15 text-emerald-100 ring-white/20',
    subtitle: 'text-emerald-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  amber: {
    shell: 'border-amber-500 bg-gradient-to-r from-amber-900 via-amber-700 to-orange-700 shadow-amber-300/40',
    icon: 'bg-white/15 text-amber-100 ring-white/20',
    subtitle: 'text-amber-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  indigo: {
    shell: 'border-indigo-500 bg-gradient-to-r from-indigo-900 via-indigo-700 to-violet-700 shadow-indigo-300/40',
    icon: 'bg-white/15 text-indigo-100 ring-white/20',
    subtitle: 'text-indigo-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  sky: {
    shell: 'border-sky-500 bg-gradient-to-r from-sky-900 via-sky-700 to-cyan-700 shadow-sky-300/40',
    icon: 'bg-white/15 text-sky-100 ring-white/20',
    subtitle: 'text-sky-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  teal: {
    shell: 'border-teal-500 bg-gradient-to-r from-teal-900 via-teal-700 to-emerald-700 shadow-teal-300/40',
    icon: 'bg-white/15 text-teal-100 ring-white/20',
    subtitle: 'text-teal-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
  violet: {
    shell: 'border-violet-500 bg-gradient-to-r from-violet-900 via-purple-700 to-fuchsia-700 shadow-violet-300/40',
    icon: 'bg-white/15 text-fuchsia-100 ring-white/20',
    subtitle: 'text-violet-100',
    message: 'border-white/20 bg-white/15 text-white',
  },
};

export const TAB_HEADER_ACTION_CLASS =
  'inline-flex h-10 min-w-[112px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent px-3 text-sm font-extrabold leading-none shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none';

export default function TabPageHeader({
  icon: Icon,
  title,
  subtitle,
  actions = null,
  message = '',
  theme = 'blue',
  className = '',
  compactMobile = false,
}) {
  const selectedTheme = THEME_CLASSES[theme] || THEME_CLASSES.blue;
  const shellLayoutClass =
    'min-h-[176px] rounded-2xl px-4 py-4 sm:min-h-[148px] sm:px-6 sm:py-5 xl:h-[132px] xl:min-h-[132px] xl:py-4';
  const contentLayoutClass = 'h-full min-h-[142px] gap-3 sm:min-h-[108px] sm:gap-4 xl:min-h-0';
  const iconLayoutClass = 'h-10 w-10 rounded-xl';
  const titleLayoutClass = 'text-xl leading-7 sm:text-2xl sm:leading-8';
  const subtitleLayoutClass = compactMobile ? 'hidden sm:block' : '';
  const messageLayoutClass = compactMobile && !message ? 'hidden sm:block' : '';

  return (
    <section
      className={`tab-page-header box-border w-full min-w-0 flex-none overflow-hidden border-2 text-white shadow-lg ${shellLayoutClass} ${selectedTheme.shell} ${className}`}
      aria-labelledby={`tab-page-header-${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <div className={`flex flex-col xl:flex-row xl:items-center xl:justify-between ${contentLayoutClass}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={`inline-flex shrink-0 items-center justify-center ring-1 ${iconLayoutClass} ${selectedTheme.icon}`}>
              {Icon ? <Icon className={compactMobile ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-6 w-6'} aria-hidden="true" /> : null}
            </span>
            <h1
              id={`tab-page-header-${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className={`min-w-0 font-black tracking-tight text-white ${titleLayoutClass}`}
            >
              {title}
            </h1>
          </div>

          <p className={`mt-2 max-w-3xl text-sm font-medium leading-5 ${subtitleLayoutClass} ${selectedTheme.subtitle}`}>
            {subtitle}
          </p>

          <div className={`mt-3 min-h-6 ${messageLayoutClass}`} aria-live="polite" aria-atomic="true">
            {message ? (
              <p className={`inline-flex min-h-6 items-center rounded-full border px-3 py-1 text-xs font-extrabold leading-4 shadow-sm ${selectedTheme.message}`}>
                {message}
              </p>
            ) : (
              <span aria-hidden="true" className="invisible inline-flex min-h-6 items-center rounded-full border px-3 py-1 text-xs font-extrabold leading-4">
                Status
              </span>
            )}
          </div>
        </div>

        {actions ? (
          <div className="tab-page-header-actions min-h-10 w-full min-w-0 shrink-0 overflow-x-auto overscroll-x-contain pb-1 xl:w-auto xl:max-w-[64%] xl:overflow-visible xl:pb-0 [&>div]:min-w-0 xl:[&>div]:!min-w-max xl:[&>div]:!flex xl:[&>div]:!w-auto xl:[&>div]:!flex-nowrap xl:[&>div]:!items-center xl:[&>div]:!justify-end [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-white/80 [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-transparent [&_svg]:shrink-0">
            {actions}
          </div>
        ) : (
          <div aria-hidden="true" className="hidden min-h-10 xl:block" />
        )}
      </div>
    </section>
  );
}
