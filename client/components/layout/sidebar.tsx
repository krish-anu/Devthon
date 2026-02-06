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
}: {
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col gap-6 bg-gradient-to-b from-(--brand-strong) to-(--brand) p-6 text-white md:rounded-r-3xl">
      <div className="space-y-1">
        <span className="text-xs uppercase tracking-widest opacity-80">
          {title}
        </span>
        <div className="text-2xl font-bold">Trash2Cash</div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2 mt-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-white/90 transition-colors hover:bg-white/10",
                active && "bg-white/20 font-semibold",
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {footer && <div className="mt-4 text-sm text-white/90">{footer}</div>}
    </aside>
  );
}
