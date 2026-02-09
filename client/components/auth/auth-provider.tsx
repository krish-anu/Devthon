"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, apiFetch, passkeyApi } from "@/lib/api";
import {
  clearAuth,
  getStoredUser,
  setAuth,
  updateStoredUser,
  getAccessToken,
} from "@/lib/auth";
import { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: "HOUSEHOLD" | "BUSINESS";
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  googleLogin: (
    token: string,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => Promise<User>;
  googleLoginWithCode: (
    code: string,
    redirectUri?: string,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => Promise<User>;
  passkeyLogin: (email: string) => Promise<User>;
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

    window.addEventListener("t2c-auth", sync);
    return () => window.removeEventListener("t2c-auth", sync);
  }, []);

  useEffect(() => {
    const init = async () => {
      // If there's no access token stored, skip the /me request to avoid 401s
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiFetch<User>("/me");
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
    type: "HOUSEHOLD" | "BUSINESS";
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
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
    const me = await apiFetch<User>("/me");
    updateStoredUser(me);
    setUser(me);
  };

  const googleLogin = async (
    token: string,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => {
    const data = await authApi.googleLogin({ token, role });
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const googleLoginWithCode = async (
    code: string,
    redirectUri?: string,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => {
    const data = await authApi.googleLoginWithCode({ code, redirectUri, role });
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const passkeyLogin = async (email: string) => {
    const { startAuthentication, browserSupportsWebAuthn } =
      await import("@simplewebauthn/browser");
    if (!browserSupportsWebAuthn()) {
      throw new Error("Your browser does not support passkeys");
    }
    // 1. Get authentication options
    const options = await passkeyApi.loginOptions(email);
    // 2. Prompt browser / authenticator
    const credential = await startAuthentication({ optionsJSON: options });
    // 3. Verify with server → receive JWT tokens
    const data = await passkeyApi.loginVerify({ email, credential });
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      googleLogin,
      googleLoginWithCode,
      passkeyLogin,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
