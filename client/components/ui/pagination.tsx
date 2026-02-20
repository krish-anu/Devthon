import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  nextCursor?: string | null;
  prevCursor?: string | null;
  onNext?: () => void;
  onPrev?: () => void;
  limit?: number;
  onLimitChange?: (n: number) => void;
  loading?: boolean;
};

export default function Pagination({
  nextCursor,
  prevCursor,
  onNext,
  onPrev,
  limit = 10,
  onLimitChange,
  loading,
}: Props) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={!prevCursor || loading}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={!nextCursor || loading}
        >
          Next
        </Button>
      </div>

      {onLimitChange && (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-[color:var(--muted)]">Rows</label>
          <select
            className="h-8 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-sm"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      )}
    </div>
  );
}
