'use client';

import { Recycle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Green Gradient */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-gradient-to-b from-(--brand) to-(--brand-strong) p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Recycle className="h-6 w-6" />
          </div>
          <span className="text-xl font-semibold">Trash2Cash</span>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">{title}</h1>
          <p className="text-white/80 text-sm max-w-xs">{subtitle}</p>
        </div>
        
        <div className="text-white/60 text-xs">
          © 2026 Trash2Cash. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form Area */}
      <div className="flex flex-1 flex-col bg-white dark:bg-[#0f172a]">
        <div className="flex justify-between items-center p-6 lg:hidden">
          <div className="flex items-center gap-2 text-(--brand)">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--brand)/10">
              <Recycle className="h-5 w-5" />
            </div>
            <span className="font-semibold">Trash2Cash</span>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="hidden lg:flex justify-end p-6">
          <ThemeToggle />
        </div>
        
        <div className="flex flex-1 items-center justify-center px-6 py-8 lg:py-0">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
