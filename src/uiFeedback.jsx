import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const UiFeedbackContext = createContext(null);

const TOAST_LIMIT = 4;
const TOAST_EXIT_MS = 220;

const VARIANT_STYLES = {
    success: {
        icon: '✓',
        ring: 'ring-emerald-500/20',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700',
        accent: 'from-emerald-500 to-teal-500',
        title: 'Tudo certo'
    },
    error: {
        icon: '!',
        ring: 'ring-rose-500/20',
        border: 'border-rose-200',
        badge: 'bg-rose-100 text-rose-700',
        accent: 'from-rose-500 to-orange-500',
        title: 'Não foi possível'
    },
    warning: {
        icon: '!',
        ring: 'ring-amber-500/20',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-700',
        accent: 'from-amber-400 to-orange-400',
        title: 'Atenção'
    },
    info: {
        icon: 'i',
        ring: 'ring-blue-500/20',
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-700',
        accent: 'from-blue-600 to-sky-500',
        title: 'Aviso'
    }
};

const CONFIRM_TONES = {
    info: {
        badge: 'bg-blue-100 text-blue-700',
        header: 'from-blue-700 via-blue-600 to-sky-500',
        button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300'
    },
    warning: {
        badge: 'bg-amber-100 text-amber-700',
        header: 'from-amber-500 via-orange-500 to-orange-400',
        button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-300'
    },
    danger: {
        badge: 'bg-rose-100 text-rose-700',
        header: 'from-rose-600 via-red-600 to-orange-500',
        button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-300'
    }
};

const AUTO_DISMISS_MS = {
    success: 3600,
    info: 4800,
    warning: 5600,
    error: 6200
};

const toSentenceCase = (value) => {
    if (!value) return '';
    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const stripLeadingEmoji = (value) => String(value || '').replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]+\s*/u, '').trim();

const extractLegacyTitle = (value) => {
    const cleaned = stripLeadingEmoji(value);
    const separatorIndex = cleaned.indexOf(':');
    if (separatorIndex <= 0) {
        return { title: '', message: cleaned };
    }

    const possibleTitle = cleaned.slice(0, separatorIndex).trim();
    const rest = cleaned.slice(separatorIndex + 1).trim();

    const isShortTitle = possibleTitle.length <= 28;
    const isLikelyLegacyHeading = possibleTitle === possibleTitle.toUpperCase();

    if (!isShortTitle || !isLikelyLegacyHeading || !rest) {
        return { title: '', message: cleaned };
    }

    return {
        title: toSentenceCase(possibleTitle),
        message: rest
    };
};

const inferVariant = (message = '') => {
    const normalized = stripLeadingEmoji(message).toLowerCase();

    if (
        normalized.includes('sucesso')
        || normalized.includes('parabens')
        || normalized.includes('atualizado')
        || normalized.includes('ativada')
        || normalized.includes('liberado novamente')
    ) {
        return 'success';
    }

    if (
        normalized.includes('erro')
        || normalized.includes('nao foi possivel')
        || normalized.includes('invalido')
        || normalized.includes('nao encontrada')
        || normalized.includes('nao consegui')
        || normalized.includes('sem permissao')
    ) {
        return 'error';
    }

    if (
        normalized.includes('atencao')
        || normalized.includes('permita')
        || normalized.includes('ative')
        || normalized.includes('digite')
        || normalized.includes('informe')
        || normalized.includes('desative')
        || normalized.includes('confirmar')
        || normalized.includes('confirme')
    ) {
        return 'warning';
    }

    return 'info';
};

const inferTone = (message = '') => {
    const normalized = stripLeadingEmoji(message).toLowerCase();

    if (
        normalized.includes('excluir')
        || normalized.includes('definitivamente')
        || normalized.includes('desfeita')
        || normalized.includes('apaga')
        || normalized.includes('remover')
    ) {
        return 'danger';
    }

    if (
        normalized.includes('admin')
        || normalized.includes('permiss')
        || normalized.includes('finalizacao')
        || normalized.includes('devolu')
        || normalized.includes('comunicado')
        || normalized.includes('campanha')
    ) {
        return 'warning';
    }

    return 'info';
};

const normalizeToastInput = (input) => {
    if (typeof input === 'string') {
        const { title, message } = extractLegacyTitle(input);
        const variant = inferVariant(message || input);
        return {
            title: title || VARIANT_STYLES[variant].title,
            message: message || stripLeadingEmoji(input),
            variant,
            durationMs: AUTO_DISMISS_MS[variant]
        };
    }

    const message = stripLeadingEmoji(input?.message || '');
    const variant = input?.variant || inferVariant(message);
    return {
        title: input?.title || extractLegacyTitle(message).title || VARIANT_STYLES[variant].title,
        message,
        variant,
        durationMs: input?.durationMs || AUTO_DISMISS_MS[variant]
    };
};

const normalizeConfirmInput = (input) => {
    if (typeof input === 'string') {
        const { title, message } = extractLegacyTitle(input);
        const tone = inferTone(message || input);
        return {
            title: title || 'Confirmar ação',
            message: message || stripLeadingEmoji(input),
            tone,
            confirmLabel: tone === 'danger' ? 'Excluir' : 'Confirmar',
            cancelLabel: 'Cancelar'
        };
    }

    const message = stripLeadingEmoji(input?.message || '');
    const tone = input?.tone || inferTone(message);
    return {
        title: input?.title || 'Confirmar ação',
        message,
        tone,
        confirmLabel: input?.confirmLabel || (tone === 'danger' ? 'Excluir' : 'Confirmar'),
        cancelLabel: input?.cancelLabel || 'Cancelar'
    };
};

const ToastViewport = ({ toasts, onDismiss }) => (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[6000] flex justify-center px-4 sm:justify-end">
        <div className="flex w-full max-w-md flex-col gap-3">
            {toasts.map((toast) => {
                const style = VARIANT_STYLES[toast.variant];
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto overflow-hidden rounded-2xl border bg-white/95 shadow-2xl ring-1 backdrop-blur transition-all duration-300 ease-out ${style.border} ${style.ring} ${toast.isVisible && !toast.isClosing ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0'}`}
                        role="status"
                    >
                        <div className={`h-1 w-full bg-gradient-to-r ${style.accent}`}></div>
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${style.badge}`}>
                                    {style.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-extrabold text-slate-800">{toast.title}</p>
                                        <button
                                            type="button"
                                            onClick={() => onDismiss(toast.id)}
                                            className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                                            aria-label="Fechar mensagem"
                                        >
                                            x
                                        </button>
                                    </div>
                                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{toast.message}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const ConfirmDialog = ({ request, onConfirm, onCancel }) => {
    if (!request) return null;

    const tone = CONFIRM_TONES[request.tone] || CONFIRM_TONES.info;

    return (
        <div
            className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className={`bg-gradient-to-r px-6 py-5 text-white ${tone.header}`}>
                    <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] ${tone.badge}`}>
                        Confirmação
                    </div>
                    <h3 className="mt-3 text-2xl font-extrabold leading-tight">{request.title}</h3>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{request.message}</p>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                            {request.cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg transition focus:outline-none focus:ring-4 ${tone.button}`}
                        >
                            {request.confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const UiFeedbackProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [confirmQueue, setConfirmQueue] = useState([]);
    const autoDismissTimersRef = useRef(new Map());
    const exitTimersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const dismissToast = useCallback((id) => {
        const timeoutId = autoDismissTimersRef.current.get(id);
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            autoDismissTimersRef.current.delete(id);
        }

        if (exitTimersRef.current.has(id)) {
            return;
        }

        setToasts((current) => current.map((toast) => (
            toast.id === id
                ? { ...toast, isClosing: true, isVisible: false }
                : toast
        )));

        const exitTimeoutId = window.setTimeout(() => {
            exitTimersRef.current.delete(id);
            removeToast(id);
        }, TOAST_EXIT_MS);

        exitTimersRef.current.set(id, exitTimeoutId);
    }, [removeToast]);

    const notify = useCallback((input) => {
        const normalized = normalizeToastInput(input);
        const toast = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            isVisible: false,
            isClosing: false,
            ...normalized
        };

        setToasts((current) => [...current, toast].slice(-TOAST_LIMIT));

        window.requestAnimationFrame(() => {
            setToasts((current) => current.map((currentToast) => (
                currentToast.id === toast.id
                    ? { ...currentToast, isVisible: true }
                    : currentToast
            )));
        });

        const timeoutId = window.setTimeout(() => {
            dismissToast(toast.id);
        }, toast.durationMs);

        autoDismissTimersRef.current.set(toast.id, timeoutId);

        return toast.id;
    }, [dismissToast]);

    const confirm = useCallback((input) => new Promise((resolve) => {
        const request = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ...normalizeConfirmInput(input),
            resolve
        };

        setConfirmQueue((current) => [...current, request]);
    }), []);

    const activeConfirm = confirmQueue[0] || null;

    const resolveConfirm = useCallback((value) => {
        setConfirmQueue((current) => {
            if (!current.length) return current;
            current[0].resolve(value);
            return current.slice(1);
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && activeConfirm) {
                resolveConfirm(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeConfirm, resolveConfirm]);

    useEffect(() => () => {
        autoDismissTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        autoDismissTimersRef.current.clear();
        exitTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        exitTimersRef.current.clear();
    }, []);

    const contextValue = useMemo(() => ({
        notify,
        confirm,
        success: (message, title = '') => notify({ message, title, variant: 'success' }),
        error: (message, title = '') => notify({ message, title, variant: 'error' }),
        warning: (message, title = '') => notify({ message, title, variant: 'warning' }),
        info: (message, title = '') => notify({ message, title, variant: 'info' })
    }), [confirm, notify]);

    return (
        <UiFeedbackContext.Provider value={contextValue}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={dismissToast} />
            <ConfirmDialog
                request={activeConfirm}
                onConfirm={() => resolveConfirm(true)}
                onCancel={() => resolveConfirm(false)}
            />
        </UiFeedbackContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUiFeedback = () => {
    const context = useContext(UiFeedbackContext);
    if (!context) {
        throw new Error('useUiFeedback must be used inside UiFeedbackProvider.');
    }
    return context;
};
