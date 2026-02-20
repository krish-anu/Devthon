"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PushNotificationToggle } from "@/components/shared/PushNotificationToggle";
import { toast } from "@/components/ui/use-toast";

type DriverSettings = {
  pickupAlerts: boolean;
  smsUpdates: boolean;
  autoAccept: boolean;
};

const defaultSettings: DriverSettings = {
  pickupAlerts: true,
  smsUpdates: true,
  autoAccept: false,
};

const storageKey = "t2c-driver-settings";

export default function DriverSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DriverSettings>(defaultSettings);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DriverSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings]);

  const displayName = useMemo(() => user?.fullName ?? "Driver", [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-(--muted)">
          Manage your driver profile and pickup preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Basic account details for this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="driver-name">Full name</Label>
            <Input
              id="driver-name"
              value={displayName}
              readOnly
              aria-readonly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driver-email">Email</Label>
            <Input
              id="driver-email"
              value={user?.email ?? ""}
              readOnly
              aria-readonly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driver-phone">Phone</Label>
            <Input
              id="driver-phone"
              value={formatPhoneForDisplay(user?.phone) ?? ""}
              readOnly
              aria-readonly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driver-role">Role</Label>
            <Input
              id="driver-role"
              value={user?.role ?? "DRIVER"}
              readOnly
              aria-readonly
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Choose how you want to receive pickup information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="driver-pickup-alerts"
              checked={settings.pickupAlerts}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  pickupAlerts: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="driver-pickup-alerts">Pickup alerts</Label>
              <p className="text-xs text-(--muted)">
                Receive notifications when a new pickup is assigned.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="driver-sms-updates"
              checked={settings.smsUpdates}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  smsUpdates: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="driver-sms-updates">SMS updates</Label>
              <p className="text-xs text-(--muted)">
                Keep SMS updates enabled for changes while on route.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="driver-auto-accept"
              checked={settings.autoAccept}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  autoAccept: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="driver-auto-accept">Auto-accept papi.ts:57 
 POST http://localhost:4000/api/auth/google/code 500 (Internal Server Error)
apiFetch	@	api.ts:57
googleLoginWithCode	@	api.ts:146
googleLoginWithCode	@	auth-provider.tsx:136
LoginPage.useGoogleLogin[handleGoogleLogin]	@	page.tsx:73
tu.i	@	client:364
(anonymous)	@	client:128
ickups</Label>
              <p className="text-xs text-(--muted)">
                Automatically accept pickups near your active zone.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSettings(defaultSettings)}
          >
            Reset to defaults
          </Button>
          <p className="text-xs text-(--muted)">
            Preferences are saved locally for this browser.
          </p>
        </CardFooter>
      </Card>

      {/* Notifications (browser + push) — same controls as user portal */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure browser and server push notifications for this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Browser notifications</h4>
            <p className="mb-3 text-sm text-(--muted)">
              Allow the browser to show notifications even when this tab is in
              the background.
            </p>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm">Status</p>
                <p className="text-xs text-(--muted)">
                  {typeof window !== "undefined" &&
                  localStorage.getItem("notifyEnabled")
                    ? "Enabled"
                    : "Disabled"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (typeof window === "undefined") return;
                    try {
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") {
                        toast({
                          title: "Permission required",
                          description:
                            "Please allow notifications in your browser settings.",
                          variant: "warning",
                        });
                        return;
                      }
                      if ("serviceWorker" in navigator) {
                        try {
                          await navigator.serviceWorker.register(
                            "/notification-sw.js",
                          );
                        } catch (err) {
                          // ignore registration failures
                        }
                      }
                      localStorage.setItem("notifyEnabled", "1");
                      toast({
                        title: "Notifications enabled",
                        description:
                          "You can receive notifications when the app is in background.",
                        variant: "success",
                      });
                    } catch (e: any) {
                      toast({
                        title: "Enable failed",
                        description:
                          e?.message ?? "Could not enable notifications",
                        variant: "error",
                      });
                    }
                  }}
                >
                  Enable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    localStorage.removeItem("notifyEnabled");
                    toast({
                      title: "Notifications disabled",
                      description: "Browser notifications turned off.",
                      variant: "default",
                    });
                  }}
                >
                  Disable
                </Button>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <h5 className="text-sm font-semibold mb-2">Push subscriptions</h5>
              <p className="mb-3 text-sm text-(--muted)">
                Enable or disable server-delivered push notifications (used to
                receive updates when the app is closed). This registers a
                subscription with the backend.
              </p>
              <div className="flex items-center gap-3">
                <PushNotificationToggle />
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      if (
                        navigator.serviceWorker &&
                        navigator.serviceWorker.controller
                      ) {
                        navigator.serviceWorker.controller.postMessage({
                          type: "TEST_NOTIFICATION",
                          title: "Test push",
                          body: "Test push from settings",
                        });
                        toast({ title: "Test sent", variant: "success" });
                        return;
                      }
                    } catch (e) {
                      // ignore
                    }
                    toast({ title: "Test unavailable", variant: "warning" });
                  }}
                >
                  Send test push
                </Button>
              </div>
            </div>

            <div className="mt-3">
              <Button
                onClick={async () => {
                  try {
                    if (
                      navigator.serviceWorker &&
                      navigator.serviceWorker.controller
                    ) {
                      try {
                        navigator.serviceWorker.controller.postMessage({
                          type: "TEST_NOTIFICATION",
                          title: "Test notification",
                          body: "This is a test from Trash2Treasure.",
                        });
                        toast({
                          title: "Test sent",
                          description:
                            "Test notification posted to service worker.",
                          variant: "success",
                        });
                        return;
                      } catch (err) {
                        // Ignore postMessage failures and fallback below
                      }
                    }
                  } catch (e) {
                    // fallback
                  }
                  if (Notification.permission === "granted") {
                    new Notification("Test notification", {
                      body: "This is a test from Trash2Treasure.",
                    });
                    toast({
                      title: "Test shown",
                      description: "Notification displayed.",
                      variant: "success",
                    });
                  } else {
                    toast({
                      title: "Cannot show",
                      description: "Allow notifications first.",
                      variant: "warning",
                    });
                  }
                }}
              >
                Send test notification
              </Button>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Notification delivery</h4>
            <p className="text-sm text-(--muted)">
              When enabled and a backend push subscription exists,
              notifications can be delivered while the app is not open. This
              enables the browser permission and registers a lightweight
              service worker for handling notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
