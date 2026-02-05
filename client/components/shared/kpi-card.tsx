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
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {label}
        </span>
        <span className="text-2xl font-semibold text-[color:var(--foreground)]">
          {value}
        </span>
        {helper && (
          <span className="text-sm text-[color:var(--muted)]">{helper}</span>
        )}
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-(--brand)/10" />
    </Card>
  );
}
