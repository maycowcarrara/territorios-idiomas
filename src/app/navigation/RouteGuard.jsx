import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUsuario } from '../../useUsuario';
import { useAuthSessionState } from '../auth/useAuthSessionState';
import { AuthStatusScreen } from '../auth/AuthStatusScreen';

export function RouteGuard({ children, adminOnly = false }) {
  const authState = useAuthSessionState();
  const { user, loading } = authState;
  const { autorizado, isAdmin, loading: loadingUsuario } = useUsuario(user);

  if (loading || (user && loadingUsuario)) {
    return <AuthStatusScreen message="Verificando acesso..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!autorizado) {
    return <Navigate to="/app" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
