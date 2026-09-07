import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('careflow_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const persistSession = (token, userData) => {
    localStorage.setItem('careflow_token', token);
    localStorage.setItem('careflow_user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      persistSession(data.access_token, data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/register', payload);
      persistSession(data.access_token, data.user);
      return data.user;
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
