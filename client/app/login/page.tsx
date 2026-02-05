"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
  const { login, googleLogin } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const user = await googleLogin(tokenResponse.access_token);
        toast({
          title: "Welcome!",
          description: "Signed in with Google successfully.",
          variant: "success",
        });
        router.replace(
          user.role === "ADMIN" ? "/admin/dashboard" : "/users/dashboard",
        );
      } catch (error: unknown) {
        toast({
          title: "Google sign-in failed",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      }
    },
    onError: () => {
      toast({
        title: "Google sign-in failed",
        description: "Please try again.",
        variant: "error",
      });
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await login(values.email, values.password);
      toast({
        title: "Welcome back!",
        description: "Redirecting to your dashboard.",
        variant: "success",
      });
      router.replace(
        user.role === "ADMIN" ? "/admin/dashboard" : "/users/dashboard",
      );
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

  return (
    <AuthLayout
      title="Turn Your Waste Into Wealth"
      subtitle="Join thousands of users earning money by recycling their waste responsibly."
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to continue to your dashboard
          </p>
        </div>
        <div className="flex items-center justify-center w-full h-full bg-background px-6 py-6 lg:py-12">
          <ThemeToggle className="fixed right-6 top-6" />
          <Card className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">
                Turn Your Waste Into Wealth
              </p>
              <h1 className="text-2xl font-semibold">Welcome Back</h1>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => handleGoogleLogin()}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            <div className="text-xs text-(--muted)">
              or continue with email
            </div>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
                  placeholder="????????"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-rose-400">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-(--muted)">
                <button type="button" className="hover:text-foreground">
                  Forgot password?
                </button>
                <Link href="/signup" className="text-(--brand)">
                  Create account
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-emerald-500 hover:text-emerald-600"
              >
                Sign Up
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
}
