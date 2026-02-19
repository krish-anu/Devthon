"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Booking, RewardsSummary } from "@/lib/types";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bookings", "recent"],
    queryFn: () => apiFetch<{ items: Booking[] }>("/bookings"),
  });
  const { data: rewards } = useQuery({
    queryKey: ["rewards", "me"],
    queryFn: () => apiFetch<RewardsSummary>("/rewards/me"),
  });

  const bookings = data?.items ?? [];

  const metrics = useMemo(() => {
    const totalEarned = bookings.reduce(
      (sum, booking) => sum + (booking.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, booking) => sum + (booking.actualWeightKg ?? 0),
      0,
    );
    const pending = bookings.filter((booking) =>
      ["CREATED", "SCHEDULED", "ASSIGNED", "IN_PROGRESS"].includes(
        booking.status,
      ),
    ).length;
    const co2 = Math.round(totalWeight * 1.7);
    return { totalEarned, totalWeight, pending, co2 };
  }, [bookings]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <p className="text-xs sm:text-sm text-(--muted)">Dashboard</p>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Welcome back, {user?.fullName?.split(" ")[0] ?? "User"}!
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-5">
        <KpiCard
          label="Total Earned"
          value={`LKR ${metrics.totalEarned.toFixed(0)}`}
          helper="Lifetime earnings"
        />
        <KpiCard
          label="Total Waste"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
          helper="Collected to date"
        />
        <KpiCard
          label="Reward Points"
          value={`${rewards?.totalPoints ?? 0}`}
          helper="Lifetime points"
        />
        <KpiCard
          label="Pending Pickups"
          value={`${metrics.pending}`}
          helper="Scheduled"
        />
        <KpiCard
          label="CO? Saved"
          value={`${metrics.co2} kg`}
          helper="Estimated"
        />
      </div>

      <Card className="flex flex-col justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-semibold">
            Ready for another pickup?
          </h3>
          <p className="text-xs sm:text-sm text-(--muted)">
            Book your next collection and earn more.
          </p>
        </div>
        <Button className="w-full sm:w-auto shrink-0" asChild>
          <Link href="/users/bookings/new">+ Book New Pickup</Link>
        </Button>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h3 className="text-base sm:text-lg font-semibold">
            Recent Bookings
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            asChild
          >
            <Link href="/users/bookings">View all</Link>
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto sm:mt-4">
          {isLoading ? (
            <div className="p-6">
              <SkeletonTableRows columns={6} rows={5} />
            </div>
          ) : (
            <Table className="md:min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Waste Type</TableHead>
                  {/* <TableHead>Weight</TableHead> */}
                  {/* <TableHead>Amount</TableHead> */}
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.slice(0, 5).map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <Link
                        href={`/users/bookings/${booking.id}`}
                        className="text-(--brand)"
                      >
                        {booking.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {booking.wasteCategory?.name ?? "Unknown"}
                    </TableCell>
                    {/* <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell> */}
                    {/* <TableCell>
                      LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                    </TableCell> */}
                    <TableCell>
                      <StatusPill status={booking.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!bookings.length && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-(--muted)"
                    >
                      No bookings yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
