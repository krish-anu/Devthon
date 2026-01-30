"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await login(values.email, values.password);
      toast({
        title: "Welcome back!",
        description: "Redirecting to your dashboard.",
        variant: "success",
      });
      window.location.href =
        user.role === "ADMIN" ? "/admin/dashboard" : "/users/dashboard";
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error?.message ?? "Please check your credentials.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-6 py-12">
      <ThemeToggle className="fixed right-6 top-6" />
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">
            Turn Your Waste Into Wealth
          </p>
          <h1 className="text-2xl font-semibold">Welcome Back</h1>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            toast({
              title: "Google sign-in",
              description: "OAuth not configured in demo.",
              variant: "info",
            })
          }
        >
          Continue with Google
        </Button>
        <div className="text-xs text-[color:var(--muted)]">
          or continue with email
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="you@email.com" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-rose-400">{errors.email.message}</p>
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
              <p className="text-xs text-rose-400">{errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
            <button
              type="button"
              className="hover:text-[color:var(--foreground)]"
            >
              Forgot password?
            </button>
            <Link href="/signup" className="text-[color:var(--brand)]">
              Create account
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
