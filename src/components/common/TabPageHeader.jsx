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
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold leading-none shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent';

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
  const shellLayoutClass = compactMobile
    ? 'min-h-0 rounded-xl px-3 py-3 sm:min-h-[140px] sm:rounded-2xl sm:px-6 sm:py-5 xl:min-h-[124px]'
    : 'min-h-[156px] rounded-2xl px-5 py-5 sm:min-h-[140px] sm:px-6 xl:min-h-[124px]';
  const contentLayoutClass = compactMobile
    ? 'min-h-0 gap-3 sm:min-h-[114px] sm:gap-4 xl:min-h-[82px]'
    : 'min-h-[114px] gap-4 xl:min-h-[82px]';
  const iconLayoutClass = compactMobile
    ? 'h-8 w-8 rounded-lg sm:h-10 sm:w-10 sm:rounded-xl'
    : 'h-10 w-10 rounded-xl';
  const titleLayoutClass = compactMobile
    ? 'text-xl leading-7 sm:text-2xl sm:leading-8'
    : 'text-2xl leading-8';
  const subtitleLayoutClass = compactMobile ? 'hidden sm:block' : '';
  const messageLayoutClass = compactMobile && !message ? 'hidden sm:block' : '';
  const actionsLayoutClass = compactMobile ? 'min-h-0 sm:min-h-10' : 'min-h-10';

  return (
    <section
      className={`tab-page-header box-border w-full flex-none border-2 text-white shadow-lg ${shellLayoutClass} ${selectedTheme.shell} ${className}`}
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
          <div className={`flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[58%] xl:justify-end ${actionsLayoutClass}`}>
            {actions}
          </div>
        ) : (
          <div aria-hidden="true" className="hidden min-h-10 xl:block" />
        )}
      </div>
    </section>
  );
}
