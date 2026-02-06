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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <div className="hidden w-64 border-r border-(--border) lg:block">
          {sidebar}
        </div>
        <div className="flex-1">
          {header && (
            <header className="border-b border-(--border) bg-(--surface-soft) px-6 py-4">
              {header}
            </header>
          )}
          <main className={cn("space-y-6 px-6 py-6", className)}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
