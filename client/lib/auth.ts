import { User } from "./types";

const ACCESS_TOKEN_KEY = "t2c_access_token";
const REFRESH_TOKEN_KEY = "t2c_refresh_token";
const USER_KEY = "t2c_user";

export function setAuth(payload: { accessToken: string; refreshToken?: string; user: User }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  window.dispatchEvent(new CustomEvent("t2c-auth"));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent("t2c-auth"));
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function updateStoredUser(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("t2c-auth"));
}
