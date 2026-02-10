"use client";

export default function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-md bg-(--surface) animate-pulse ${className ?? ''}`} />;
}

export function SkeletonTableRows({ columns = 6, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="w-full space-y-3">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4">
          <div className="h-4 w-12 rounded bg-(--surface) animate-pulse" />
          {Array.from({ length: columns - 1 }).map((__, colIdx) => (
            <div key={colIdx} className="h-4 flex-1 rounded bg-(--surface) animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4, cardClass = 'h-24' }: { count?: number; cardClass?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border border-(--border) bg-(--surface) p-4 ${cardClass}`}>
          <div className="h-4 w-32 rounded bg-(--surface) animate-pulse mb-3" />
          <div className="h-3 w-full rounded bg-(--surface) animate-pulse mb-2" />
          <div className="h-3 w-3/4 rounded bg-(--surface) animate-pulse" />
        </div>
      ))}
    </div>
  );
}
