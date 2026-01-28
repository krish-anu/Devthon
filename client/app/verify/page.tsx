'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { authApi } from '@/lib/api';

export default function VerifyPage() {
  const [code, setCode] = useState(Array(6).fill(''));
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const handleChange = (index: number, value: string) => {
    if (!/\d?/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
  };

  const handleVerify = async () => {
    const otp = code.join('');
    if (otp.length < 6) {
      toast({ title: 'Enter full code', description: 'Please enter all 6 digits.', variant: 'warning' });
      return;
    }
    await authApi.verifyOtp({ code: otp });
    toast({ title: 'Verified', description: 'Your account is ready.', variant: 'success' });
    window.location.href = '/app/dashboard';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Verify Your Identity</p>
          <h1 className="text-2xl font-semibold">Enter the 6-digit code</h1>
        </div>
        <div className="flex gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              className="h-12 w-12 rounded-xl border border-white/10 bg-slate-950/60 text-center text-lg text-white"
              maxLength={1}
            />
          ))}
        </div>
        <div className="text-xs text-white/60">Resend code in {seconds}s</div>
        <Button className="w-full" onClick={handleVerify}>
          Verify
        </Button>
      </Card>
    </div>
  );
}
