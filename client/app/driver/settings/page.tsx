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
    </div>
  );
}
