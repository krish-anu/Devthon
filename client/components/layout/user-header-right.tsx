"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { RewardsSummary } from "@/lib/types";
import { UserMenu } from "@/components/layout/user-menu";

export function UserHeaderRight() {
  const { data } = useQuery({
    queryKey: ["rewards", "me"],
    queryFn: () => apiFetch<RewardsSummary>("/rewards/me"),
  });

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-3 rounded-full border border-(--border) bg-(--card) px-3 py-1 text-xs text-(--foreground) sm:flex">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-(--muted)">Lifetime</div>
          <div className="text-sm font-semibold">{data?.totalPoints ?? 0}</div>
        </div>
        <div className="h-6 w-px bg-(--border)" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-(--muted)">This Month</div>
          <div className="text-sm font-semibold">{data?.monthPoints ?? 0}</div>
        </div>
      </div>
      <UserMenu />
    </div>
  );
}

export default UserHeaderRight;
