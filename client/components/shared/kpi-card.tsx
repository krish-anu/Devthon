import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", accent)}>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <span className="text-[0.65rem] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[color:var(--muted)] truncate">
          {label}
        </span>
        <span className="text-lg sm:text-xl md:text-2xl font-semibold text-[color:var(--foreground)] truncate">
          {value}
        </span>
        {helper && (
          <span className="text-xs sm:text-sm text-[color:var(--muted)] truncate">
            {helper}
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute -right-8 sm:-right-10 -top-8 sm:-top-10 h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-(--brand)/10" />
    </Card>
  );
}
