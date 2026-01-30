"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { authApi } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function VerifyPage() {
  const [code, setCode] = useState(Array(6).fill(""));
  const [seconds, setSeconds] = useState(45);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length < 6) {
      toast({
        title: "Enter full code",
        description: "Please enter all 6 digits.",
        variant: "warning",
      });
      return;
    }
    await authApi.verifyOtp({ code: otp });
    toast({
      title: "Verified",
      description: "Your account is ready.",
      variant: "success",
    });
    window.location.href = "/users/dashboard";
  };

  const handleResend = () => {
    if (seconds > 0) return;
    setSeconds(45);
    toast({
      title: "Code resent",
      description: "A new verification code has been sent.",
      variant: "info",
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <ThemeToggle className="fixed right-6 top-6" />
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-(--brand)">
            Verify Your Identity
          </p>
          <h1 className="text-2xl font-semibold">Enter the 6-digit code</h1>
        </div>

        <div className="flex justify-center gap-3">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              className="h-12 w-12 rounded-xl border border-(--border) bg-(--surface-soft) text-center text-lg text-foreground"
              maxLength={1}
              inputMode="numeric"
            />
          ))}
        </div>
        <div className="text-xs text-(--muted)">Resend code in {seconds}s</div>
        <Button className="w-full" onClick={handleVerify}>
          Verify
        </Button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Didn't receive the email?{" "}
          <button 
            type="button"
            onClick={handleResend}
            className={`font-medium ${seconds > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-emerald-500 hover:text-emerald-600'}`}
            disabled={seconds > 0}
          >
            Resend
          </button>
        </p>
      </Card>
    </div>
  );
}
