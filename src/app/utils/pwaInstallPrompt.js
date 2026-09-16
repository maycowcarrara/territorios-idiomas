let deferredPromptGlobal = null;

export const getDeferredPrompt = () => deferredPromptGlobal;

export const setDeferredPrompt = (prompt) => {
    deferredPromptGlobal = prompt;
};

export const clearDeferredPrompt = () => {
    deferredPromptGlobal = null;
};
