"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

/**
 * Converts a URL-safe Base64 VAPID key to a Uint8Array for the Web Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  // Flag to indicate the server is missing VAPID keys
  const [vapidMissing, setVapidMissing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Check support & current subscription on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, []);

  /** Subscribe to push notifications */
  const subscribe = useCallback(async () => {
    if (!isSupported || !getAccessToken()) return false;
    setIsLoading(true);
    try {
      // 1. Register service worker if needed
      const reg = await navigator.serviceWorker.register("/notification-sw.js");
      await navigator.serviceWorker.ready;

      // 2. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setIsLoading(false);
        return false;
      }

      // 3. Get VAPID public key from server
      let publicKeyResponse;
      try {
        publicKeyResponse = await apiFetch<{ publicKey: string | null }>(
          "/notifications/push/public-key",
        );
      } catch (e: any) {
        // Detect structured server error or message indicating missing VAPID keys
        const msg = (e?.message || '').toString();
        if (msg.includes('VAPID') || msg.includes('VAPID_NOT_CONFIGURED')) {
          console.warn('Push subscription failed: VAPID public key not configured on server');
          setVapidMissing(true);
          setIsLoading(false);
          return false;
        }
        throw e;
      }

      const { publicKey } = publicKeyResponse;
      if (!publicKey) {
        console.warn("VAPID public key not configured on server");
        setVapidMissing(true);
        setIsLoading(false);
        return false;
      }

      // 4. Subscribe via PushManager
      const keyArray = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      });

      // Optimistically mark subscribed in the UI
      setIsSubscribed(true);

      // 5. Send subscription to server
      const json = sub.toJSON();
      try {
        await apiFetch("/notifications/push/subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
            },
          }),
        });
      } catch (e) {
        // If server fails, undo local subscription and revert UI
        console.error('Server failed to save subscription, cleaning up:', e);
        try {
          await sub.unsubscribe();
        } catch (uerr) {
          console.error('Failed to unsubscribe locally after server error:', uerr);
        }
        setIsSubscribed(false);
        throw e;
      }

      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /** Unsubscribe from push notifications */
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);
    // Optimistically update UI
    setIsSubscribed(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Ask server to remove subscription
        try {
          await apiFetch("/notifications/push/unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        } catch (e: any) {
          const msg = (e?.message || '').toString();
          // If user is unauthorized (session expired / invalid tokens), treat as session expiration:
          if (msg.includes('401') || /unauthor/i.test(msg)) {
            console.warn('Server returned Unauthorized while removing subscription. Clearing local session and unsubscribing locally.');
            // Mark session expired for the UI to show a helpful message
            setSessionExpired(true);
            // Try to clean up local subscription even if server refused
            try {
              await sub.unsubscribe();
            } catch (uerr) {
              console.error('Failed to unsubscribe locally after 401:', uerr);
            }

            // Clear local auth (so UI shows logged-out state)
            try {
              const { setAuth } = await import('@/lib/auth');
              setAuth(null as any);
            } catch (aerr) {
              console.error('Failed to clear auth after 401:', aerr);
            }

            return true; // consider unsubscribe successful from user's perspective
          }

          console.error('Server failed to remove subscription:', e);
          // Revert optimistic UI and surface failure
          setIsSubscribed(true);
          return false;
        }
        // Unsubscribe locally
        await sub.unsubscribe();
      }
      return true;
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      // Revert optimistic UI on error
      setIsSubscribed(true);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    vapidMissing,
    sessionExpired,
  };
}

