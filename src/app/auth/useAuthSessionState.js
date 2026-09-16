import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';

export const buildSafeAuthUser = (currentUser) => {
  if (!currentUser) return null;

  return {
    uid: currentUser.uid || '',
    email: currentUser.email || '',
    displayName: currentUser.displayName || '',
    photoURL: currentUser.photoURL || '',
    isAnonymous: Boolean(currentUser.isAnonymous),
    providerId: currentUser.providerId || 'firebase'
  };
};

export function useAuthSessionState() {
  const [authState, setAuthState] = useState(() => ({
    user: buildSafeAuthUser(auth.currentUser),
    loading: true
  }));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthState({
        user: buildSafeAuthUser(currentUser),
        loading: false
      });
    });

    return () => unsubscribe();
  }, []);

  return authState;
}
