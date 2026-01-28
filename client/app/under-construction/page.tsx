'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

export default function UnderConstructionPage() {
  const [email, setEmail] = useState('');

  const handleNotify = async () => {
    try {
      await apiFetch('/public/launch-notify', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, false);
      toast({ title: 'Thanks!', description: 'We will notify you at launch.', variant: 'success' });
      setEmail('');
    } catch (error: any) {
      toast({ title: 'Unable to register', description: error?.message, variant: 'error' });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-6 py-12">
      <Card className="w-full max-w-lg space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">Under Construction</p>
          <h1 className="text-3xl font-semibold">We are building something fresh.</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            The marketplace portal is almost ready. Leave your email to be notified on launch.
          </p>
        </div>
        <div className="space-y-3">
          <Input placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <div className="h-2 w-full rounded-full bg-[color:var(--surface-strong)]">
            <div className="h-full w-[65%] rounded-full bg-emerald-400" />
          </div>
          <Button className="w-full" onClick={handleNotify}>
            Notify Me
          </Button>
        </div>
      </Card>
    </div>
  );
}
