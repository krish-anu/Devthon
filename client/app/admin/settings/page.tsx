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

type AdminSettings = {
  emailReports: boolean;
  systemAlerts: boolean;
  newUserAlerts: boolean;
};

const defaultSettings: AdminSettings = {
  emailReports: true,
  systemAlerts: true,
  newUserAlerts: false,
};

const storageKey = "t2c-admin-settings";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AdminSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings]);

  const displayName = useMemo(() => user?.fullName ?? "Admin", [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-(--muted)">
          Manage your admin profile and notification preferences.
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
            <Label htmlFor="admin-name">Full name</Label>
            <Input id="admin-name" value={displayName} readOnly aria-readonly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              value={user?.email ?? ""}
              readOnly
              aria-readonly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-phone">Phone</Label>
            <Input
              id="admin-phone"
              value={formatPhoneForDisplay(user?.phone) ?? ""}
              readOnly
              aria-readonly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-role">Role</Label>
            <Input
              id="admin-role"
              value={user?.role ?? "ADMIN"}
              readOnly
              aria-readonly
            />
          </div>
        </CardContent>
      </Card>

      {/* <Card> */}
        {/* <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Customize what alerts you receive in the admin console.
          </CardDescription>
        </CardHeader> */}
        {/* <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="admin-email-reports"
              checked={settings.emailReports}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  emailReports: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="admin-email-reports">Email reports</Label>
              <p className="text-xs text-(--muted)">
                Get daily revenue and pickup summaries via email.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="admin-system-alerts"
              checked={settings.systemAlerts}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  systemAlerts: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="admin-system-alerts">System alerts</Label>
              <p className="text-xs text-(--muted)">
                Receive critical platform status notifications.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="admin-new-user-alerts"
              checked={settings.newUserAlerts}
              onCheckedChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  newUserAlerts: Boolean(value),
                }))
              }
            />
            <div>
              <Label htmlFor="admin-new-user-alerts">New user alerts</Label>
              <p className="text-xs text-(--muted)">
                Get notified when new users register.
              </p>
            </div>
          </div>
        </CardContent> */}
        {/* <CardFooter className="flex flex-wrap gap-2">
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
        </CardFooter> */}
      {/* </Card> */}
    </div>
  );
}
