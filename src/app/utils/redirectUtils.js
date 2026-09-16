import { POST_LOGIN_REDIRECT_KEY } from '../constants/appConstants';

export const normalizePostLoginRedirect = (value) => {
  const path = String(value || '').trim();
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/app';
  return path;
};

export const rememberPostLoginRedirect = (value) => {
  if (typeof window === 'undefined') return;

  const path = normalizePostLoginRedirect(value);
  if (path === '/') return;

  try {
    window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
  } catch {
    // Ignora storage indisponível.
  }
};

export const consumePostLoginRedirect = () => {
  if (typeof window === 'undefined') return '/app';

  try {
    const path = normalizePostLoginRedirect(window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY));
    window.localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return path;
  } catch {
    return '/app';
  }
};

export const peekPostLoginRedirect = () => {
  if (typeof window === 'undefined') return '/app';

  try {
    return normalizePostLoginRedirect(window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY));
  } catch {
    return '/app';
  }
};

export const getRedirectFromCurrentUrl = () => {
  if (typeof window === 'undefined') return '';

  try {
    return normalizePostLoginRedirect(new URL(window.location.href).searchParams.get('redirect'));
  } catch {
    return '';
  }
};

export const rememberRedirectFromCurrentUrl = () => {
  const redirect = getRedirectFromCurrentUrl();
  if (redirect && redirect !== '/app') {
    rememberPostLoginRedirect(redirect);
  }
};
