"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { authApi } from "@/lib/api";
import { AuthLayout } from "@/components/auth/auth-layout";

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
    <AuthLayout
      title="Verify Your Identity"
      subtitle="We sent a verification code to your phone number for security."
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enter Verification Code</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We sent a 6 digit code to +1 (555) ***-**42
          </p>
        </div>

        <div className="flex justify-center gap-3">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-14 w-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center text-xl font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              maxLength={1}
              inputMode="numeric"
            />
          ))}
        </div>

        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Resend code in <span className="font-medium text-slate-700 dark:text-slate-300">00:{seconds.toString().padStart(2, '0')}</span>
        </div>

        <Button 
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white" 
          onClick={handleVerify}
        >
          Verify Code
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
      </div>
    </AuthLayout>
  );
}
