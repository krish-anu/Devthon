'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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
    <aside className="flex h-full w-full flex-col gap-6 bg-slate-950/80 p-6 text-white">
      <div className="space-y-1">
        <span className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">{title}</span>
        <div className="text-lg font-semibold">Trash2Cash</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white',
                active && 'bg-emerald-500/20 text-white',
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
