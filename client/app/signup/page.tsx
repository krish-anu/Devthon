"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "@/components/ui/use-toast";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useGoogleLogin } from "@react-oauth/google";
import PhoneInput from "@/components/ui/phone-input";
import { isValidSriLankaPhone } from "@/lib/phone";
import { executeRecaptcha } from "@/lib/recaptcha";


const schema = z
  .object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().refine((v) => isValidSriLankaPhone(v), {
      message: "Enter a valid Sri Lanka phone number (e.g. +94 77 123 4567)",
    }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and a number",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    type: z.enum(["HOUSEHOLD", "BUSINESS"]),
    terms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const pathname = usePathname();
  const role = pathname?.startsWith("/admin")
    ? "ADMIN"
    : pathname?.startsWith("/driver")
      ? "DRIVER"
      : "CUSTOMER";
  const { register, handleSubmit, setValue, watch, formState } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { type: "HOUSEHOLD", terms: false },
    });
  const { errors, isSubmitting } = formState;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const {
    register: registerUser,
    googleLogin,
    googleLoginWithCode,
    user,
    loading: authLoading,
  } = useAuth();
  const termsChecked = watch("terms");

  const redirectToDashboard = (userRole: string) => {
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
      return;
    }
    if (userRole === "DRIVER") {
      router.replace("/driver/dashboard");
      return;
    }
    router.replace("/users/dashboard");
  };

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      redirectToDashboard(user.role);
    }
  }, [user, authLoading, router]);

  const handleGoogleSignup = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      try {
        if ((tokenResponse as any).code) {
          const user = await googleLoginWithCode(
            (tokenResponse as any).code,
            undefined,
            true,
            role,
          );
          toast({
            title: "Welcome!",
            description: "Signed up with Google successfully.",
            variant: "success",
          });
          redirectToDashboard(user.role);
          return;
        }

        const token =
          (tokenResponse as any).access_token ||
          (tokenResponse as any).credential;
        const user = await googleLogin(token, true, role);
        toast({
          title: "Welcome!",
          description: "Signed up with Google successfully.",
          variant: "success",
        });
        redirectToDashboard(user.role);
      } catch (error: any) {
        const msg = error?.message ?? "Please try again.";
        const description =
          msg === "Email already registered"
            ? "That email is already registered. Please log in instead."
            : msg;
        toast({
          title: "Google sign-up failed",
          description,
          variant: "error",
        });
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast({
        title: "Google sign-up failed",
        description: "Please try again.",
        variant: "error",
      });
      setGoogleLoading(false);
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const { terms, confirmPassword, ...payload } = values;
      // debug log before calling API
      // eslint-disable-next-line no-console
      console.debug("Signup onSubmit payload:", { ...payload, role });

      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = (await executeRecaptcha("signup")) as string | null;
      } catch (err) {
        console.error("reCAPTCHA failed:", err);
        toast({
          title: "reCAPTCHA",
          description: "Failed to run reCAPTCHA. Please try again.",
          variant: "error",
        });
        return;
      }

      const user = await registerUser({
        ...payload,
        role,
        recaptchaToken: recaptchaToken ?? undefined,
      });
      // eslint-disable-next-line no-console
      console.debug("Signup success, user:", user);
      toast({
        title: "Account created",
        description: "Welcome to Trash2Treasure.",
        variant: "success",
      });
      window.location.href = "/";
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error("Signup error:", error);
      toast({
        title: "Signup failed",
        description: error?.message ?? "Please check your details.",
        variant: "error",
      });
    }
  };

  return (
    <AuthLayout
      title="Turn Your Waste Into Wealth"
      subtitle="Join thousands of users earning money by recycling their waste responsibly."
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-center w-full h-full bg-background px-4 sm:px-6 py-4 sm:py-6 lg:py-12">
          <ThemeToggle className="fixed right-4 sm:right-6 top-4 sm:top-6 z-50" />
          <Card className="w-full max-w-md space-y-4 sm:space-y-6">
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-[0.65rem] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-(--brand)">
                Join the Green Revolution
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold">Create your account</h1>
            </div>

            <Button
              variant="outline"
              className="w-full h-10 sm:h-11 gap-2 text-xs sm:text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              loading={googleLoading}
              onClick={() => {
                setGoogleLoading(true);
                handleGoogleSignup();
              }}
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign up with Google
            </Button>
            <form
              className="space-y-3 sm:space-y-4"
              onSubmit={handleSubmit(onSubmit)}
              onSubmitCapture={() => {
                // eslint-disable-next-line no-console
                console.debug("signup form onSubmitCapture");
              }}
            >
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Full Name" {...register("fullName")} />
                {errors.fullName && (
                  <p className="text-xs text-rose-500">
                    {errors.fullName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input placeholder="you@email.com" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-rose-500">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <PhoneInput
                  className="w-full"
                  placeholder="+94 77 123 4567"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-rose-500">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choose a strong password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="h-9 w-9 sm:h-11 sm:w-11 inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]"
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3-11-8 1.05-2.42 2.6-4.47 4.54-5.87" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    aria-label={
                      showConfirm
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    className="h-9 w-9 sm:h-11 sm:w-11 inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]"
                  >
                    {showConfirm ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3-11-8 1.05-2.42 2.6-4.47 4.54-5.87" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-rose-500">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {["HOUSEHOLD", "BUSINESS"].map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() =>
                        setValue("type", type as "HOUSEHOLD" | "BUSINESS")
                      }
                      className={`rounded-full border px-4 py-2 text-xs ${
                        watch("type") === type
                          ? "border-(--brand) bg-(--brand)/20 text-(--brand-strong)"
                          : "border-(--border) text-(--muted)"
                      }`}
                    >
                      {type === "HOUSEHOLD" ? "Household" : "Business"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs text-(--muted)">
                <Checkbox
                  checked={termsChecked}
                  onCheckedChange={(checked) =>
                    setValue("terms", Boolean(checked))
                  }
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-(--brand) hover:text-(--brand-strong) underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="text-(--brand) hover:text-(--brand-strong) underline">
                    Privacy Policy
                  </Link>.
                  {errors.terms && (
                    <span className="block text-rose-400">
                      {errors.terms.message}
                    </span>
                  )}
                </span>
              </div>

              <Button
                type="submit"
                className="w-full h-10 sm:h-11 bg-(--brand) hover:bg-(--brand-strong) text-white text-xs sm:text-sm"
                loading={isSubmitting}
                onClick={() => {
                  // eslint-disable-next-line no-console
                  console.debug("Create Account button clicked");
                }}
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{"   "}
              <Link
                href="/login"
                className="font-medium text-(--brand) hover:text-(--brand-strong) ml-1 sm:ml-2 transition-colors"
              >
                Login
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
}
