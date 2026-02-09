"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAuth } from "@/lib/auth";
import { getAccessTokenFromHash } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash || "";
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = params.get("access_token");
        if (!accessToken) {
          router.replace("/login");
          return;
        }

        // Use the access token to fetch /me directly
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
        });
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        const user = await response.json();

        // Persist access token and user in client storage
        setAuth({ accessToken, user });

        // Redirect to dashboard
        router.replace("/users/dashboard");
      } catch (e) {
        console.error(e);
        router.replace("/login");
      }
    })();
  }, [router]);

  return <div className="p-8">Signing you in…</div>;
}
