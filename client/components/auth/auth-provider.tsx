"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { authApi, apiFetch, passkeyApi } from "@/lib/api";
import { executeRecaptcha } from "@/lib/recaptcha";
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
  login: (
    email: string,
    password: string,
    recaptchaToken?: string,
  ) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: "HOUSEHOLD" | "BUSINESS";
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
    recaptchaToken?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUser: (user: User) => void;
  googleLogin: (
    token: string,
    signup?: boolean,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => Promise<User>;
  googleLoginWithCode: (
    code: string,
    redirectUri?: string,
    signup?: boolean,
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

  const isRecaptchaVerificationFailure = (error: unknown) =>
    error instanceof Error &&
    error.message.toLowerCase().includes("recaptcha verification failed");

  const login = async (
    email: string,
    password: string,
    recaptchaToken?: string,
  ) => {
    try {
      const data = await authApi.login({ email, password, recaptchaToken });
      setAuth(data);
      setUser(data.user);
      return data.user;
    } catch (error) {
      if (isRecaptchaVerificationFailure(error)) {
        const retryToken = await executeRecaptcha("login");
        if (retryToken && retryToken !== recaptchaToken) {
          const data = await authApi.login({
            email,
            password,
            recaptchaToken: retryToken,
          });
          setAuth(data);
          setUser(data.user);
          return data.user;
        }
      }
      throw error;
    }
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: "HOUSEHOLD" | "BUSINESS";
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
    recaptchaToken?: string;
  }) => {
    try {
      const data = await authApi.register(payload);
      setAuth(data);
      setUser(data.user);
      return data.user;
    } catch (error) {
      if (isRecaptchaVerificationFailure(error)) {
        const retryToken = await executeRecaptcha("signup");
        if (retryToken && retryToken !== payload.recaptchaToken) {
          const data = await authApi.register({
            ...payload,
            recaptchaToken: retryToken,
          });
          setAuth(data);
          setUser(data.user);
          return data.user;
        }
      }
      throw error;
    }
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
    // cache-bust avatar URL so browsers/CDNs fetch newest image after updates
    const avatarUrl = (me as any)?.avatarUrl ?? (me as any)?.avatar ?? null;
    if (avatarUrl && !avatarUrl.includes('?v=')) {
      (me as any).avatarUrl = `${avatarUrl}?v=${Date.now()}`;
    }
    updateStoredUser(me);
    setUser(me);
  };

  const updateUser = (user: User) => {
    // append cache-bust to avatarUrl when present
    const avatarUrl = (user as any)?.avatarUrl ?? (user as any)?.avatar ?? null;
    const patched = { ...user } as any;
    if (avatarUrl && !avatarUrl.includes('?v=')) {
      patched.avatarUrl = `${avatarUrl}?v=${Date.now()}`;
    }
    updateStoredUser(patched);
    setUser(patched as User);
  };

  const googleLogin = async (
    token: string,
    signup?: boolean,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => {
    const data = await authApi.googleLogin({ token, signup, role });
    setAuth(data);
    setUser(data.user);
    return data.user;
  };

  const googleLoginWithCode = async (
    code: string,
    redirectUri?: string,
    signup?: boolean,
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER",
  ) => {
    const data = await authApi.googleLoginWithCode({
      code,
      redirectUri,
      signup,
      role,
    });
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshProfile,
    updateUser,
    googleLogin,
    googleLoginWithCode,
    passkeyLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
