"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [index, setIndex] = useState(0);

  const lightImages = useMemo(
    () => [
      "/bg/light/img2.png",
      "/bg/light/img3.png",
      "/bg/light/img4.png",
      "/bg/light/img5.png",
      "/bg/light/img6.png",
    ],
    [],
  );

  const darkImages = useMemo(
    () => [
      "/bg/dark/dimg1.png",
      "/bg/dark/dimg2.png",
      "/bg/dark/dimg3.png",
      "/bg/dark/dimg4.png",
    ],
    [],
  );

  const images = theme === "dark" ? darkImages : lightImages;

  // Track loaded images to avoid flicker when swapping
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const getTheme = () =>
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";

    const apply = () => setTheme(getTheme());
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
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
      {/* Left Panel - Green Gradient (hidden on mobile & tablet, shown on lg+) */}
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-b from-(--brand) to-(--brand-strong) p-10 text-white">
        <div
          className="pointer-events-none absolute inset-0 auth-bg-container"
          style={{ backgroundColor: theme === "dark" ? "#1a1a1a" : "#f5f5f5" }}
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              className={`h-full w-full object-cover auth-bg-image ${i === index ? "active" : ""} ${loaded[i] ? "loaded" : ""}`}
            />
          ))}
          <div className="absolute inset-0 auth-bg-overlay z-22" />
        </div>
        <div className="relative z-25 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Go to landing page"
            title="Go to landing page"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
              <img
                src="/recycle%20logo.png"
                alt="Trash2Treasure logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <span className="text-xl font-bold text-[color:var(--brand)]">
              Trash2Treasure
            </span>
          </Link>
        </div>

        <div className="relative z-500 space-y-4">
          <h1 className="text-4xl font-bold leading-tight text-white">
            {title}
          </h1>
          <p className="text-white/80 text-sm max-w-xs">{subtitle}</p>
        </div>

        <div className="relative z-500 text-white/60 text-xs">
          © 2026 Trash2Treasure. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form Area (full width on mobile/tablet) */}
      <div className="flex flex-1 flex-col min-h-screen lg:min-h-0">
        {/* Mobile/tablet logo bar */}
        <div className="flex items-center p-4 sm:p-5 lg:hidden">
          <Link
            href="/"
            aria-label="Go to landing page"
            title="Go to landing page"
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--brand)/10 overflow-hidden">
              <img
                src="/recycle%20logo.png"
                alt="Trash2Treasure logo"
                className="h-5 w-5 object-contain"
              />
            </div>
            <span className="font-semibold text-foreground">
              Trash2Treasure
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 sm:px-6 py-4 sm:py-6 lg:py-0">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
