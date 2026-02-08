"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  sidebar,
  header,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar fixed on large screens and flush to the left */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:block z-30">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="relative h-full w-72 max-w-[80%]">
            <div className="absolute right-4 top-4 z-10">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-(--ink) shadow"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      {/* Full-width header bar (fixed at top). Inner container keeps content aligned */}
      {header && (
        <header className="fixed top-0 left-0 right-0 border-b border-(--border) bg-(--surface-soft) h-16 z-20">
          <div className="mx-auto h-16 flex items-center w-full max-w-7xl px-6 lg:pl-64">
            <button
              type="button"
              className="mr-3 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) text-(--ink) lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {header}
          </div>
        </header>
      )}

      {!header && (
        <button
          type="button"
          className="fixed left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--surface-soft) text-(--ink) lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Main content gets left padding on large screens and top padding when header exists to account for the fixed header */}
      <div
        className={cn(
          "mx-auto w-full max-w-7xl lg:pl-64",
          Boolean(header) ? "pt-16" : undefined,
        )}
      >
        <div className="flex min-h-screen">
          <div className="flex-1">
            <main className={cn("space-y-6 px-6 py-6", className)}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
