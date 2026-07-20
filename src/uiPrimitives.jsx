import React from 'react';
import { cardBaseClass, cn } from './uiClasses';

export function AppPage({ children, className = '', contentClassName = '' }) {
  return (
    <div className={cn('min-h-screen bg-slate-50 px-4 py-4 font-sans text-slate-800 sm:px-6 lg:px-8', className)}>
      <div className={cn('mx-auto max-w-7xl', contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function AppCard({ children, className = '' }) {
  return (
    <section className={cn(cardBaseClass, 'p-4 sm:p-5', className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  chips,
  actions,
  className = ''
}) {
  return (
    <header className={cn(cardBaseClass, 'mb-5 overflow-hidden p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 text-center md:text-left">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm font-medium text-slate-500">
              {subtitle}
            </p>
          ) : null}
          {chips ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {chips}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

const modalSizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl'
};

export function ModalFrame({
  isOpen,
  onClose,
  title,
  subtitle,
  titleIcon,
  headerExtra,
  children,
  footer,
  size = 'md',
  accentClass = 'bg-blue-600',
  panelClassName = '',
  bodyClassName = '',
  footerClassName = ''
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-stretch justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in sm:items-center"
      onClick={onClose}
    >
      <div
        className={cn(
          'flex h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[88vh]',
          modalSizeClass[size] || modalSizeClass.md,
          panelClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn('shrink-0 border-b border-white/10 px-4 py-4 text-white sm:px-5', accentClass)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-lg font-black leading-tight">
                {titleIcon ? <span className="shrink-0">{titleIcon}</span> : null}
                <span>{title}</span>
              </h3>
              {subtitle ? (
                <p className="mt-1 text-sm font-medium text-white/80">
                  {subtitle}
                </p>
              ) : null}
              {headerExtra ? <div className="mt-2">{headerExtra}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-bold leading-none text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Fechar"
            >
              &times;
            </button>
          </div>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto p-4', bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div className={cn('shrink-0 border-t border-slate-100 bg-slate-50 p-4', footerClassName)}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
