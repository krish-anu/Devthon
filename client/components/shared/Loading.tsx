"use client";

import { Loader2 } from "lucide-react";

export default function Loading({ message }: { message?: string }) {
  return (
    <div className="flex w-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-(--muted)" />
        {message ? <div className="text-sm text-(--muted)">{message}</div> : null}
      </div>
    </div>
  );
}
