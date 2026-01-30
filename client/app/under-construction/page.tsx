'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { Recycle } from 'lucide-react';
import Link from 'next/link';

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
    <div className="flex min-h-screen flex-col bg-linear-to-br from-emerald-400 via-emerald-300 to-green-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Recycle className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-white">Trash2Cash</span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-lg space-y-6 text-center">
          <div className="text-6xl">🚧</div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">We&apos;re Building Something Great!</h1>
            <p className="mt-2 text-sm text-(--muted)">
              Our website is currently under construction.
              <br />
              We&apos;re working hard to bring you an amazing experience.
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Completion Progress</span>
              <span className="font-semibold text-emerald-500">70%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-[70%] rounded-full bg-linear-to-r from-emerald-400 to-emerald-500 transition-all" />
            </div>
          </div>

          {/* Email Signup */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Get notified when we launch</p>
            <div className="flex gap-2">
              <Input 
                placeholder="Enter your email address" 
                value={email} 
                onChange={(event) => setEmail(event.target.value)}
                className="flex-1"
              />
              <Button onClick={handleNotify} className="bg-emerald-500 text-white hover:bg-emerald-600">
                Get Started
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
