'use client';

import { useEffect, useMemo, useState } from 'react';
import { Recycle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [index, setIndex] = useState(0);

  const lightImages = useMemo(
    () => [
      '/bg/light/img2.png',
      '/bg/light/img3.png',
      '/bg/light/img4.png',
      '/bg/light/img5.png',
      '/bg/light/img6.png',
    ],
    [],
  );

  const darkImages = useMemo(
    () => [
      '/bg/dark/dimg1.png',
      '/bg/dark/dimg2.png',
      '/bg/dark/dimg3.png',
      '/bg/dark/dimg4.png',
    ],
    [],
  );

  const images = theme === 'dark' ? darkImages : lightImages;

  // Track loaded images to avoid flicker when swapping
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const getTheme = () =>
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';

    const apply = () => setTheme(getTheme());
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  // Preload all images for the active theme
  useEffect(() => {
    const nextLoaded: Record<number, boolean> = {};
    images.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        nextLoaded[i] = true;
        setLoaded((prev) => ({ ...prev, [i]: true }));
      };
      img.onerror = () => {
        // mark as loaded to prevent blocking
        nextLoaded[i] = true;
        setLoaded((prev) => ({ ...prev, [i]: true }));
      };
    });
    // reset index so animation starts at 0
    setIndex(0);
  }, [theme, images]);

  useEffect(() => {
    if (!images.length) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 20000);
    return () => window.clearInterval(id);
  }, [images.length, theme]);

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Green Gradient */}
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-b from-(--brand) to-(--brand-strong) p-10 text-white">
        <div className="pointer-events-none absolute inset-0 auth-bg-container">
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              className={`h-full w-full object-cover auth-bg-image ${i === index ? 'active' : ''} ${loaded[i] ? 'loaded' : ''}`}
            />
          ))}
          <div className="absolute inset-0 auth-bg-overlay" />
        </div>
        <div className="relative z-20 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 overflow-hidden">
            <img src="/recycle%20logo.png" alt="Trash2Cash" className="h-6 w-6 object-contain" />
          </div>
          <span className="text-xl font-semibold text-[color:var(--auth-text)]">Trash2Cash</span>
        </div>
        
        <div className="relative z-20 space-y-4">
          <h1 className="text-4xl font-bold leading-tight text-[color:var(--auth-text)]">{title}</h1>
          <p className="text-[color:var(--auth-text)] opacity-80 text-sm max-w-xs">{subtitle}</p>
        </div>
        
        <div className="relative z-20 text-[color:var(--auth-text)] opacity-60 text-xs">
          © 2026 Trash2Cash. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form Area */}
      <div className="flex flex-1 flex-col bg-white dark:bg-[#0f172a]">
        <div className="flex justify-between items-center p-6 lg:hidden">
          <div className="flex items-center gap-2 text-[color:var(--auth-text)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--brand)/10 overflow-hidden">
              <img src="/recycle%20logo.png" alt="Trash2Cash" className="h-5 w-5 object-contain" />
            </div>
            <span className="font-semibold text-[color:var(--auth-text)]">Trash2Cash</span>
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
