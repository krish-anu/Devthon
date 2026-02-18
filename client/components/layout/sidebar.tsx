"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function Sidebar({
  title,
  items,
  footer,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen flex flex-col gap-4 sm:gap-6 bg-linear-to-b from-(--brand-strong) to-(--brand) p-4 sm:p-6 text-white md:rounded-r-3xl overflow-y-auto">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center overflow-hidden rounded-2xl bg-(--brand)/20">
          <img
            src="/recycle%20logo.png"
            alt="Trash2Treasure"
            className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
          />
        </div>
        <div className="min-w-0">
          <span className="text-[0.65rem] sm:text-xs uppercase tracking-wider sm:tracking-widest opacity-80 block truncate">
            {title}
          </span>
          <div className="text-base sm:text-2xl font-bold truncate">
            Trash2Treasure
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1.5 sm:gap-2 mt-1 sm:mt-2 overflow-y-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 sm:gap-3 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white/90 transition-colors hover:bg-white/10",
                active && "bg-white/20 font-semibold",
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {footer && (
        <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-white/90 shrink-0">
          {footer}
        </div>
      )}
    </aside>
  );
}
