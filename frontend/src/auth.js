import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);

/**
 * Sessione utente: il JWT emesso dal backend è salvato in localStorage e il profilo
 * (email, ruolo, token di analisi disponibili) viene letto da GET /auth/me.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    refreshUser()
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout, refreshUser]);

  const startSession = useCallback(
    async ({ token }) => {
      setToken(token);
      try {
        return await refreshUser();
      } catch (err) {
        setToken(null);
        throw err;
      }
    },
    [refreshUser]
  );

  const login = useCallback(
    (email, password) => api.auth.login(email, password).then(startSession),
    [startSession]
  );

  const register = useCallback(
    (email, password) => api.auth.register(email, password).then(startSession),
    [startSession]
  );

  // Aggiorna il saldo mostrato nell'interfaccia dopo un'analisi, senza rileggere il profilo
  const updateTokens = useCallback(
    (tokens) => setUser((current) => (current ? { ...current, tokens } : current)),
    []
  );

  const value = useMemo(
    () => ({ user, checking, login, register, logout, refreshUser, updateTokens }),
    [user, checking, login, register, logout, refreshUser, updateTokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
