"use client";

import { useState, useEffect, useCallback } from "react";
import { passkeyApi } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

/**
 * Lazily load @simplewebauthn/browser (ESM).
 * We cache the module so it's only imported once.
 */
let _webauthnBrowser: typeof import("@simplewebauthn/browser") | null = null;

async function getWebAuthnBrowser() {
  if (!_webauthnBrowser) {
    _webauthnBrowser = await import("@simplewebauthn/browser");
  }
  return _webauthnBrowser;
}

/**
 * Hook that exposes passkey registration, login, and browser-support detection.
 */
export function usePasskey() {
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detect WebAuthn support on mount
  useEffect(() => {
    getWebAuthnBrowser().then((mod) => {
      setSupported(mod.browserSupportsWebAuthn());
    });
  }, []);

  /**
   * Register a new passkey for the currently-authenticated user.
   * Call this while the user has a valid JWT session.
   */
  const registerPasskey = useCallback(async () => {
    setLoading(true);
    try {
      const mod = await getWebAuthnBrowser();

      // 1. Get registration options from server
      const options = await passkeyApi.registerOptions();

      // 2. Prompt browser / authenticator
      const credential = await mod.startRegistration({ optionsJSON: options });

      // 3. Send credential back for verification
      const result = await passkeyApi.registerVerify(credential);

      if (result.verified) {
        toast({
          title: "Passkey registered!",
          description: "You can now sign in with your passkey on this device.",
          variant: "success",
        });
      }
      return result;
    } catch (error: unknown) {
      // User cancelled or browser error
      const message =
        error instanceof Error ? error.message : "Passkey registration failed";

      // Don't toast if the user simply cancelled the dialog
      if (
        !(
          message.includes("cancelled") ||
          message.includes("canceled") ||
          message.includes("NotAllowedError")
        )
      ) {
        toast({
          title: "Passkey registration failed",
          description: message,
          variant: "error",
        });
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Authenticate with a passkey.
   * Returns `{ user, accessToken, refreshToken }` on success.
   */
  const loginWithPasskey = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const mod = await getWebAuthnBrowser();

      // 1. Get authentication options from server
      const options = await passkeyApi.loginOptions(email);

      // 2. Prompt browser / authenticator
      const credential = await mod.startAuthentication({
        optionsJSON: options,
      });

      // 3. Send assertion back for verification → receive JWT tokens
      const result = await passkeyApi.loginVerify({ email, credential });
      return result;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Passkey login failed";

      if (
        !(
          message.includes("cancelled") ||
          message.includes("canceled") ||
          message.includes("NotAllowedError")
        )
      ) {
        toast({
          title: "Passkey login failed",
          description: message,
          variant: "error",
        });
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, loading, registerPasskey, loginWithPasskey };
}
