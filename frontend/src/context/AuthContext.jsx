import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

function getInitialUser() {
  try {
    const stored = localStorage.getItem('careflow_user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      localStorage.removeItem('careflow_user');
      return null;
    }
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    localStorage.removeItem('careflow_user');
    localStorage.removeItem('careflow_token');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);
  const [loading, setLoading] = useState(false);

  const persistSession = (token, userData) => {
    if (token) {
      localStorage.setItem('careflow_token', token);
    }
    if (userData) {
      localStorage.setItem('careflow_user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      const safeUser = data?.user || { email, role: 'admin' };
      persistSession(data?.access_token || ('token-' + Date.now()), safeUser);
      return safeUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/register', payload);
      const safeUser = data?.user || { email: payload?.email, role: payload?.role || 'patient' };
      persistSession(data?.access_token || ('token-' + Date.now()), safeUser);
      return safeUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('careflow_token');
    localStorage.removeItem('careflow_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
