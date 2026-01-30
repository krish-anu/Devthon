"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { authApi } from "@/lib/api";
import { useForm as useForm2 } from "react-hook-form";

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(3),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [twoStepEnabled, setTwoStepEnabled] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const names = (user?.fullName ?? "").split(" ");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: names[0] ?? "",
      lastName: names[1] ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
    },
  });

  useEffect(() => {
    reset({
      firstName: names[0] ?? "",
      lastName: names[1] ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      address: user?.address ?? "",
    });
  }, [user, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await apiFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: `${values.firstName} ${values.lastName}`.trim(),
          email: values.email,
          phone: values.phone,
          address: values.address,
        }),
      });
      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Changes saved.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message,
        variant: "error",
      });
    }
  };

  // Change password form
  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
      confirmPassword: z.string().min(6),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  type PasswordForm = z.infer<typeof passwordSchema>;

  const {
    register: pwRegister,
    handleSubmit: pwHandleSubmit,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
    reset: resetPw,
  } = useForm2<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (vals: PasswordForm) => {
    try {
      await apiFetch("/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: vals.currentPassword,
          newPassword: vals.newPassword,
        }),
      });
      toast({
        title: "Password changed",
        description: "Your password was updated.",
        variant: "success",
      });
      resetPw();
    } catch (err: any) {
      toast({
        title: "Change failed",
        description: err?.message ?? "Unable to change password",
        variant: "error",
      });
    }
  };

  // Two-step verification handlers (uses authApi.sendOtp / verifyOtp)
  const handleSendOtp = async () => {
    if (!user?.email)
      return toast({
        title: "No email",
        description: "No email found for your account",
        variant: "warning",
      });
    try {
      await authApi.sendOtp({ email: user.email });
      setOtpSent(true);
      toast({
        title: "OTP sent",
        description: "Check your email for the verification code.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Send failed",
        description: err?.message ?? "Unable to send OTP",
        variant: "error",
      });
    }
  };

  const [otpCode, setOtpCode] = useState("");
  const handleVerifyOtp = async () => {
    try {
      const res = await authApi.verifyOtp({ code: otpCode });
      if (res?.verified) {
        setTwoStepEnabled(true);
        setOtpSent(false);
        toast({
          title: "Two-step enabled",
          description: "Two-step verification enabled for your account.",
          variant: "success",
        });
      } else {
        toast({
          title: "Verification failed",
          description: "Invalid code",
          variant: "error",
        });
      }
    } catch (err: any) {
      toast({
        title: "Verify failed",
        description: err?.message ?? "Unable to verify code",
        variant: "error",
      });
    }
  };

  const initials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>

      {/* Profile Card */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-600 dark:bg-emerald-900/30">
            {initials}
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">{user?.fullName ?? "User"}</h3>
            <p className="text-sm text-(--muted)">{user?.email}</p>
            <p className="text-xs text-(--muted)">
              Member since{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "--"}
            </p>
          </div>
        </div>
        <Button variant="outline" className="border-emerald-500 text-emerald-500 hover:bg-emerald-50">
          Change photo
        </Button>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <Card>
            <h4 className="mb-4 text-lg font-semibold text-foreground">Personal Information</h4>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleSubmit(onSubmit)}
            >
              <div className="space-y-2">
                <Label className="text-sm text-(--muted)">First Name</Label>
                <Input {...register("firstName")} placeholder="John" />
                {errors.firstName && (
                  <p className="text-xs text-rose-400">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-(--muted)">Last name</Label>
                <Input {...register("lastName")} placeholder="Doe" />
                {errors.lastName && (
                  <p className="text-xs text-rose-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-(--muted)">Email Address</Label>
                <Input {...register("email")} placeholder="john.doe@email.com" />
                {errors.email && (
                  <p className="text-xs text-rose-400">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-(--muted)">Phone Number</Label>
                <Input {...register("phone")} placeholder="+1 (555) 123-4567" />
                {errors.phone && (
                  <p className="text-xs text-rose-400">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm text-(--muted)">Address</Label>
                <Input {...register("address")} placeholder="123 Main Street, Downtown, NY 10001" />
                {errors.address && (
                  <p className="text-xs text-rose-400">
                    {errors.address.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 text-white hover:bg-emerald-600">
                  Save Changes
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-4 text-lg font-semibold text-foreground">Change password</h4>
                <form
                  className="grid gap-3"
                  onSubmit={pwHandleSubmit(onChangePassword)}
                >
                  <div className="space-y-2">
                    <Label className="text-sm text-(--muted)">Current password</Label>
                    <Input type="password" {...pwRegister("currentPassword")} />
                    {pwErrors.currentPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-(--muted)">New password</Label>
                    <Input type="password" {...pwRegister("newPassword")} />
                    {pwErrors.newPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-(--muted)">Confirm new password</Label>
                    <Input type="password" {...pwRegister("confirmPassword")} />
                    {pwErrors.confirmPassword && (
                      <p className="text-xs text-rose-400">
                        {pwErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={pwSubmitting}>
                      Change password
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetPw()}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Two-step verification
                </h4>
                <p className="mb-3 text-sm text-(--muted)">
                  Add an extra layer of security by requiring a one-time code on
                  sign in.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Status</p>
                      <p className="text-xs text-(--muted)">
                        {twoStepEnabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                    <div>
                      {!twoStepEnabled ? (
                        <Button onClick={handleSendOtp}>Enable</Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setTwoStepEnabled(false)}
                        >
                          Disable
                        </Button>
                      )}
                    </div>
                  </div>

                  {otpSent && (
                    <div className="space-y-2">
                      <Label>Enter verification code</Label>
                      <Input
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <Button onClick={handleVerifyOtp}>Verify code</Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setOtpSent(false);
                            setOtpCode("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Browser notifications
                </h4>
                <p className="mb-3 text-sm text-(--muted)">
                  Allow the browser to show notifications even when this tab is
                  in the background.
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
                              // registration failed, continue
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
                <div className="mt-3">
                  <Button
                    onClick={async () => {
                      try {
                        if (
                          navigator.serviceWorker &&
                          navigator.serviceWorker.controller
                        ) {
                          navigator.serviceWorker.controller.postMessage({
                            type: "TEST_NOTIFICATION",
                            title: "Test notification",
                            body: "This is a test from Trash2Cash.",
                          });
                          toast({
                            title: "Test sent",
                            description:
                              "Test notification posted to service worker.",
                            variant: "success",
                          });
                          return;
                        }
                      } catch (e) {
                        // fallback
                      }
                      if (Notification.permission === "granted") {
                        new Notification("Test notification", {
                          body: "This is a test from Trash2Cash.",
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
                <h4 className="mb-2 text-sm font-semibold">
                  Notification delivery
                </h4>
                <p className="text-sm text-(--muted)">
                  When enabled and a backend push subscription exists,
                  notifications can be delivered while the app is not open. This
                  enables the browser permission and registers a lightweight
                  service worker for handling notifications.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-6">
          <Card>
            <h4 className="mb-4 text-lg font-semibold text-foreground">Payment Methods</h4>
            <p className="text-sm text-(--muted)">
              Add or manage your payment methods for receiving payouts.
            </p>
            <div className="mt-4">
              <Button variant="outline" className="border-emerald-500 text-emerald-500 hover:bg-emerald-50">
                + Add Payment Method
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
