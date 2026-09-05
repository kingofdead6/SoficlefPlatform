import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await authApi.me();
      setUser(current);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Failed to resolve session:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { user: signedIn } = await authApi.login(email, password);
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    // Navigate away immediately so ProtectedRoute never re-renders on the page
    // being left behind — that render would otherwise stash this now-abandoned
    // URL as location.state.from, which the next login on this tab/session
    // would blindly reuse (surfacing the previous user's last page).
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
