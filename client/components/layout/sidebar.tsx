"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Recycle } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function Sidebar({
  title,
  items,
  footer,
}: {
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col gap-6 bg-(--surface-soft) p-6 text-foreground">
      {/* Logo/Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <Recycle className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold text-foreground">Trash2Cash</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-(--muted) transition-colors hover:bg-(--surface-strong) hover:text-foreground",
                active && "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      {footer && <div>{footer}</div>}
    </aside>
  );
}
