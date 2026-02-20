"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { executeRecaptcha } from "@/lib/recaptcha";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "@/components/ui/use-toast";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useGoogleLogin } from "@react-oauth/google";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const {
    login,
    googleLogin,
    googleLoginWithCode,
    passkeyLogin,
    user,
    loading: authLoading,
  } = useAuth();
  const router = useRouter();
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const emailValue = watch("email");

  // Detect WebAuthn / passkey support on mount
  useEffect(() => {
    import("@simplewebauthn/browser").then((mod) => {
      setPasskeySupported(mod.browserSupportsWebAuthn());
    });
  }, []);

  const redirectToDashboard = (role: string) => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
      return;
    }
    if (role === "DRIVER") {
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
  }, [user, authLoading]);

  const handleGoogleLogin = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      try {
        if ((tokenResponse as any).code) {
          const user = await googleLoginWithCode((tokenResponse as any).code);
          toast({
            title: "Welcome!",
            description: "Signed in with Google successfully.",
            variant: "success",
          });
          redirectToDashboard(user.role);
          return;
        }

        const token =
          (tokenResponse as any).access_token ||
          (tokenResponse as any).credential;
        const user = await googleLogin(token);
        toast({
          title: "Welcome!",
          description: "Signed in with Google successfully.",
          variant: "success",
        });
        redirectToDashboard(user.role);
      } catch (error: unknown) {
        toast({
          title: "Google sign-in failed",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast({
        title: "Google sign-in failed",
        description: "Please try again.",
        variant: "error",
      });
      setGoogleLoading(false);
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = (await executeRecaptcha("login")) as string | null;
      } catch (err) {
        console.error("reCAPTCHA failed:", err);
        toast({
          title: "reCAPTCHA",
          description: "Failed to run reCAPTCHA. Please try again.",
          variant: "error",
        });
        return;
      }

      const user = await login(
        values.email,
        values.password,
        recaptchaToken ?? undefined,
      );
      toast({
        title: "Welcome back!",
        description: "Redirecting to your dashboard.",
        variant: "success",
      });
      redirectToDashboard(user.role);
    } catch (error: unknown) {
      toast({
        title: "Login failed",
        description:
          error instanceof Error
            ? error.message
            : "Please check your credentials.",
        variant: "error",
      });
    }
  };

  const handlePasskeyLogin = async () => {
    const email = emailValue?.trim();
    if (!email) {
      toast({
        title: "Email required",
        description:
          "Please enter your email address first to use passkey login.",
        variant: "error",
      });
      return;
    }
    setPasskeyLoading(true);
    try {
      const user = await passkeyLogin(email);
      toast({
        title: "Welcome back!",
        description: "Signed in with passkey successfully.",
        variant: "success",
      });
      redirectToDashboard(user.role);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Passkey login failed";
      // Don't show toast if user cancelled the authenticator dialog
      if (
        !message.includes("cancelled") &&
        !message.includes("canceled") &&
        !message.includes("NotAllowedError")
      ) {
        toast({
          title: "Passkey login failed",
          description: message,
          variant: "error",
        });
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Turn Your Waste Into Wealth"
      subtitle="Join thousands of users earning money by recycling their waste responsibly."
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-center w-full min-h-screen bg-background px-4 sm:px-6 py-4 sm:py-6 lg:py-12">
          <ThemeToggle className="fixed right-4 sm:right-6 top-4 sm:top-6 z-50" />
          <Card className="w-full max-w-md space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-[0.65rem] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-(--brand)">
                Turn Your Waste Into Wealth
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold">
                Welcome Back
              </h1>
            </div>

            <Button
              variant="outline"
              className="w-full h-10 sm:h-11 gap-2 text-xs sm:text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              loading={googleLoading}
              onClick={() => {
                setGoogleLoading(true);
                handleGoogleLogin();
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
              Continue with Google
            </Button>

            {passkeySupported && (
              <Button
                variant="outline"
                className="w-full h-10 sm:h-11 gap-2 text-xs sm:text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={handlePasskeyLogin}
                loading={passkeyLoading}
              >
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C9.24 2 7 4.24 7 7C7 9.76 9.24 12 12 12C14.76 12 17 9.76 17 7C17 4.24 14.76 2 12 2ZM12 10C10.35 10 9 8.65 9 7C9 5.35 10.35 4 12 4C13.65 4 15 5.35 15 7C15 8.65 13.65 10 12 10Z"
                    fill="currentColor"
                  />
                  <path
                    d="M18 16L15 19L16.5 20.5L18 19L19.5 20.5L21 19L19.5 17.5L21 16L18 16Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 13C8.13 13 5 14.79 5 17V20H14V18H7V17C7 15.9 9.24 15 12 15C13.08 15 14.07 15.18 14.85 15.47L16.1 14.22C14.93 13.47 13.5 13 12 13Z"
                    fill="currentColor"
                  />
                </svg>
                {passkeyLoading ? "Authenticating..." : "Sign in with Passkey"}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-[0.65rem] sm:text-xs">
                <span className="bg-white dark:bg-slate-900 px-2 text-black">
                  or continue with email
                </span>
              </div>
            </div>

            <form
              className="space-y-3 sm:space-y-4"
              onSubmit={handleSubmit(onSubmit)}
            >
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="you@email.com" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-rose-400">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="**************"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-rose-400">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-[0.65rem] sm:text-xs text-(--muted)">
                <button
                  type="button"
                  className="hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
                <Link
                  href="/signup"
                  className="text-(--brand) hover:text-(--brand-strong) transition-colors"
                >
                  Create account
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full bg-(--brand) hover:bg-(--brand-strong) text-white h-10 sm:h-11 text-xs sm:text-sm"
                loading={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Don&apos;t have an account?{"   "}
              <Link
                href="/signup"
                className="font-medium text-(--brand) hover:text-(--brand-strong) ml-1 sm:ml-2 transition-colors"
              >
                Sign Up
              </Link>
            </p>

            <p className="text-center text-[0.65rem] sm:text-xs text-slate-500 dark:text-slate-400 mt-3 sm:mt-4">
              By signing in, you agree to our{" "}
              <Link
                href="/terms"
                className="font-medium text-(--brand) hover:text-(--brand-strong) underline"
                target="_blank"
              >
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-(--brand) hover:text-(--brand-strong) underline"
                target="_blank"
              >
                Privacy Policy
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
}
