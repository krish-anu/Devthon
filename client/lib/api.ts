import { getAccessToken, setAuth } from "./auth";
import { User } from "./types";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === "undefined") {
    return trimTrailingSlash(configured || "http://localhost:4000/api");
  }

  if (!configured) {
    // In hosted environments, prefer same-origin API routing (e.g. via reverse proxy).
    return `${window.location.origin}/api`;
  }

  try {
    const parsed = new URL(configured, window.location.origin);

    // If a loopback API URL is configured in a hosted browser context,
    // route through same-origin instead of direct :4000 calls.
    if (
      parsed.protocol.startsWith("http") &&
      isLoopbackHost(parsed.hostname) &&
      !isLoopbackHost(window.location.hostname)
    ) {
      const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/api";
      return trimTrailingSlash(`${window.location.origin}${path}`);
    }

    // Avoid mixed-content requests when frontend is served over HTTPS.
    if (
      window.location.protocol === "https:" &&
      parsed.protocol === "http:" &&
      parsed.hostname === window.location.hostname
    ) {
      parsed.protocol = "https:";
    }

    return trimTrailingSlash(parsed.toString());
  } catch {
    return trimTrailingSlash(configured);
  }
}

const API_URL = resolveApiUrl();

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
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as AuthResponse;
  setAuth({ accessToken: data.accessToken, user: data.user } as any);
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
  const hasBody = options.body !== undefined && options.body !== null;

  // Only set JSON content type when a request body exists.
  // Setting it on GET/HEAD triggers unnecessary CORS preflight.
  if (
    hasBody &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: (options as any).credentials ?? "include",
    });
  } catch (e: any) {
    // Provide a clearer error when the network/socket is unavailable.
    console.error("Network error while fetching", `${API_URL}${path}`, e);
    throw new Error(`Network error connecting to ${API_URL}${path}: ${e?.message || e}`);
  }

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
  login: (payload: { email: string; password: string; recaptchaToken?: string }) =>
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
    recaptchaToken?: string;
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
  googleLogin: (payload: {
    token: string;
    signup?: boolean;
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  }) =>
    apiFetch<AuthResponse>(
      "/auth/google",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    ),
  googleLoginWithCode: (payload: {
    code: string;
    redirectUri?: string;
    signup?: boolean;
    role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";
  }) =>
    apiFetch<AuthResponse>(
      "/auth/google/code",
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
