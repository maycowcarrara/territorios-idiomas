export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const cardBaseClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
export const fieldBaseClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export const buttonBaseClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';

export const buttonToneClass = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
  subtle: 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
  warning: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  dangerSoft: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
};

export function buttonClass(tone = 'primary', className = '') {
  return cn(buttonBaseClass, buttonToneClass[tone] || buttonToneClass.primary, className);
}
