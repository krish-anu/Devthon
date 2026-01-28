'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, apiFetch } from '@/lib/api';
import { clearAuth, getStoredUser, setAuth, updateStoredUser } from '@/lib/auth';
import { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: 'HOUSEHOLD' | 'BUSINESS';
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    const sync = () => {
      const latest = getStoredUser();
      setUser(latest);
    };

    window.addEventListener('t2c-auth', sync);
    return () => window.removeEventListener('t2c-auth', sync);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await apiFetch<User>('/me');
        updateStoredUser(me);
        setUser(me);
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: 'HOUSEHOLD' | 'BUSINESS';
  }) => {
    const data = await authApi.register(payload);
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    const me = await apiFetch<User>('/me');
    updateStoredUser(me);
    setUser(me);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshProfile }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
