import { getAccessToken, getRefreshToken, setAuth } from "./auth";
import { User } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000/api`
    : "http://localhost:4000/api");

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

async function parseError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || text;
  } catch {
    return text || response.statusText;
  }
}

export async function refreshTokens() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as AuthResponse;
  setAuth(data);
  return data;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const accessToken = auth ? getAccessToken() : null;

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && auth && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return apiFetch<T>(path, options, auth, false);
    }
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  login: (payload: { email: string; password: string }) =>
    apiFetch<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    type: "HOUSEHOLD" | "BUSINESS";
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  }) =>
    apiFetch<AuthResponse>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
  logout: () =>
    apiFetch<{ success: boolean }>("/auth/logout", {
      method: "POST",
    }),
  sendOtp: (payload: { email: string }) =>
    apiFetch<{ success: boolean }>(
      "/auth/otp/send",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
  verifyOtp: (payload: { code: string }) =>
    apiFetch<{ verified: boolean }>(
      "/auth/otp/verify",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
  googleLogin: (payload: { token: string }) =>
    apiFetch<AuthResponse>(
      "/auth/google",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
};

/* ------------------------------------------------------------------ */
/*  Passkey (WebAuthn) API                                             */
/* ------------------------------------------------------------------ */

export const passkeyApi = {
  /** Get registration options (requires auth) */
  registerOptions: () =>
    apiFetch<any>("/auth/passkey/register/options", { method: "POST" }),

  /** Send browser credential to server for verification (requires auth) */
  registerVerify: (credential: any) =>
    apiFetch<{ verified: boolean }>("/auth/passkey/register/verify", {
      method: "POST",
      body: JSON.stringify(credential),
    }),

  /** Get authentication options for a given email (no auth) */
  loginOptions: (email: string) =>
    apiFetch<any>(
      "/auth/passkey/login/options",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),

  /** Verify passkey authentication and receive tokens (no auth) */
  loginVerify: (payload: { email: string; credential: any }) =>
    apiFetch<AuthResponse>(
      "/auth/passkey/login/verify",
      { method: "POST", body: JSON.stringify(payload) },
      false,
    ),

  /** List current user's registered passkeys (requires auth) */
  list: () => apiFetch<any[]>("/auth/passkey/list"),

  /** Delete a passkey by ID (requires auth) */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/auth/passkey/${id}`, {
      method: "DELETE",
    }),
};
