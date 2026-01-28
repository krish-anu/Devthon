import { cn } from '@/lib/utils';

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
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
        <div className="hidden w-64 border-r border-[color:var(--border)] lg:block">{sidebar}</div>
        <div className="flex-1">
          {header && (
            <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-4">
              {header}
            </header>
          )}
          <main className={cn('space-y-6 px-6 py-6', className)}>{children}</main>
        </div>
      </div>
    </div>
  );
}
