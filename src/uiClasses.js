export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const cardBaseClass = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 transition-all';
export const fieldBaseClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 disabled:bg-slate-50 disabled:text-slate-400';

export const buttonBaseClass = 'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

export const buttonToneClass = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  secondary: 'border border-slate-200/90 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2',
  subtle: 'border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200/80 focus-visible:ring-2 focus-visible:ring-slate-300',
  dark: 'bg-slate-900 text-white shadow-sm shadow-slate-950/20 hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
  warning: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 active:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 active:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
  dangerSoft: 'border border-red-200/80 bg-red-50/80 text-red-700 hover:bg-red-100 active:bg-red-100/90 focus-visible:ring-2 focus-visible:ring-red-300'
};

export function buttonClass(tone = 'primary', className = '') {
  return cn(buttonBaseClass, buttonToneClass[tone] || buttonToneClass.primary, className);
}

export const iconButtonBaseClass = 'inline-flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

export function iconButtonClass(tone = 'ghost', className = '') {
  const tones = {
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    white: 'bg-white/10 text-white hover:bg-white/20 active:bg-white/25',
    subtle: 'border border-slate-200/80 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900',
    danger: 'text-red-500 hover:bg-red-50 hover:text-red-700'
  };
  return cn(iconButtonBaseClass, tones[tone] || tones.ghost, className);
}

export const badgeBaseClass = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide';
