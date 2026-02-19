"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  LeaderboardResponse,
  RewardsSummary,
  LeaderboardEntry,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

function LeaderboardTable({
  title,
  subtitle,
  items,
  highlightUserId,
}: {
  title: string;
  subtitle?: string;
  items: LeaderboardEntry[];
  highlightUserId?: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-(--muted)">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4">
        <Table className="md:min-w-[420px]">
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow
                key={entry.userId}
                className={cn(
                  highlightUserId === entry.userId && "bg-(--brand)/10",
                )}
              >
                <TableCell className="font-medium">#{entry.rank}</TableCell>
                <TableCell>{entry.name}</TableCell>
                <TableCell className="text-right font-semibold">
                  {entry.points}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-(--muted)">
                  No points yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default function RewardsPage() {
  const { user } = useAuth();

  const { data: rewards } = useQuery({
    queryKey: ["rewards", "me"],
    queryFn: () => apiFetch<RewardsSummary>("/rewards/me"),
  });

  const { data: monthlyLeaderboard } = useQuery({
    queryKey: ["leaderboard", "monthly"],
    queryFn: () => apiFetch<LeaderboardResponse>("/leaderboard/monthly"),
  });

  const { data: overallLeaderboard } = useQuery({
    queryKey: ["leaderboard", "overall"],
    queryFn: () => apiFetch<LeaderboardResponse>("/leaderboard/overall"),
  });

  const monthLabel = useMemo(() => {
    if (!monthlyLeaderboard?.monthRange?.start) return "This Month";
    const date = new Date(monthlyLeaderboard.monthRange.start);
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [monthlyLeaderboard?.monthRange?.start]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-(--muted)">Rewards</p>
        <h1 className="text-2xl font-semibold">Your Rewards</h1>
      </div>

      <Card>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Your Points</h3>
            <p className="text-sm text-(--muted)">
              Points never expire and reset monthly for leaderboards.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">
                Lifetime Points
              </p>
              <p className="text-2xl font-semibold">
                {rewards?.totalPoints ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-(--border) bg-(--card) px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">
                This Month
              </p>
              <p className="text-2xl font-semibold">
                {rewards?.monthPoints ?? 0}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div>
            <h3 className="text-lg font-semibold">How to earn points</h3>
            <p className="text-sm text-(--muted)">
              Earn bonus points on top of your LKR payouts.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {(rewards?.howToEarn ?? []).map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-(--border) bg-(--card) px-3 py-2"
              >
                <span className="text-sm">{item.label}</span>
                <span className="text-sm font-semibold text-(--brand)">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <LeaderboardTable
            title="Monthly Leaderboard"
            subtitle={`Top 10 - ${monthLabel}`}
            items={monthlyLeaderboard?.items ?? []}
            highlightUserId={user?.id}
          />
          <LeaderboardTable
            title="Overall Leaderboard"
            subtitle="Top 10 all-time"
            items={overallLeaderboard?.items ?? []}
            highlightUserId={user?.id}
          />
        </div>
      </div>
    </div>
  );
}
