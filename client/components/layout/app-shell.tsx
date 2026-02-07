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
      {/* Sidebar fixed on large screens and flush to the left */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:block z-20">
        {sidebar}
      </div>

      {/* Full-width header bar (bleed across viewport). Inner container keeps content aligned */}
      {header && (
        <header className="border-b border-(--border) bg-(--surface-soft) z-10">
          <div className="mx-auto w-full max-w-7xl px-6 py-4 lg:pl-64">
            {header}
          </div>
        </header>
      )}

      {/* Main content gets left padding on large screens to account for the sidebar */}
      <div className="mx-auto w-full max-w-7xl lg:pl-64">
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
