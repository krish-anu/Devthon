"use client";

import { useMemo, useState, useEffect } from "react";
import Pagination from '@/components/ui/pagination';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Booking, WasteCategory } from "@/lib/types";
import {
  getBookingStatusLabel,
  isUserPaymentDueStatus,
  normalizeBookingStatus,
} from "@/lib/booking-status";
import { Card } from "@/components/ui/card";
import Skeleton, { SkeletonTableRows } from "@/components/shared/Skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";

type UserBookingsResponse = {
  items: Booking[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export default function BookingHistoryPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["public-waste-categories"],
    queryFn: () => apiFetch<WasteCategory[]>("/public/waste-categories", {}, false),
  });

  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery<UserBookingsResponse>({
    queryKey: ["bookings", status, search, category, afterCursor, beforeCursor, limit],
    queryFn: () =>
      apiFetch<UserBookingsResponse>(
        `/bookings?${new URLSearchParams({
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
          limit: String(limit),
          ...(afterCursor ? { after: afterCursor } : {}),
          ...(beforeCursor ? { before: beforeCursor } : {}),
        }).toString()}`,
      ),
    refetchInterval: 12000,
    placeholderData: (previousData) => previousData,
  });

  const bookings = data?.items ?? [];

  useEffect(() => {
    setAfterCursor(null);
    setBeforeCursor(null);
  }, [status, search, category]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onMutate: async (id: string) => {
      setDeletingId(id);
      await queryClient.cancelQueries({ queryKey: ["bookings", status, search, category] });
      const previous = queryClient.getQueryData<{ items: Booking[] }>(["bookings", status, search, category]);
      if (previous) {
        queryClient.setQueryData(["bookings", status, search, category], {
          ...previous,
          items: previous.items.filter((b) => b.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      queryClient.setQueryData(["bookings", status, search, category], context?.previous);
      setDeletingId(null);
      toast({ title: "Delete failed", description: "Failed to delete booking.", variant: "error" });
    },
    onSettled: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onSuccess: () => {
      toast({ title: "Booking deleted", variant: "success" });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(id);
    }
  };

  const metrics = useMemo(() => {
    const completed = bookings.filter(
      (b) => normalizeBookingStatus(b.status) === "COMPLETED",
    ).length;
    const totalEarned = bookings.reduce(
      (sum, b) => sum + (b.finalAmountLkr ?? 0),
      0,
    );
    const totalWeight = bookings.reduce(
      (sum, b) => sum + (b.actualWeightKg ?? 0),
      0,
    );
    return { total: bookings.length, completed, totalEarned, totalWeight };
  }, [bookings]);

  const exportCsv = () => {
    const rows = bookings.map((booking) => [
      booking.id,
      booking.wasteCategory?.name ?? "",
      booking.actualWeightKg ?? "",
      booking.finalAmountLkr ?? booking.estimatedMaxAmount,
      getBookingStatusLabel(booking.status, "CUSTOMER"),
      booking.createdAt,
    ]);
    const header = [
      "Booking ID",
      "Waste Type",
      "Weight",
      "Amount",
      "Status",
      "Date",
    ];
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)">
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)"
            disabled={categoriesLoading}
          >
            {categoriesLoading ? (
              <option>Loading categories...</option>
            ) : (
              <>
                <option value="">All Categories</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-xl border border-(--border) bg-(--surface-soft) px-4 text-sm text-(--muted)"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            className="w-full sm:w-64"
            placeholder="Search bookings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="outline" onClick={exportCsv} className="w-full sm:w-auto">
            Export CSV
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Bookings" value={`${metrics.total}`} />
        <KpiCard label="Completed" value={`${metrics.completed}`} />
        <KpiCard
          label="Total Earned"
          value={`LKR ${metrics.totalEarned.toFixed(0)}`}
        />
        <KpiCard
          label="Total Weight"
          value={`${metrics.totalWeight.toFixed(1)} kg`}
        />
      </div>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={7} rows={6} />
        </Card>
      ) : (
        <Card>
          <Table className="md:min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <a
                      href={`/users/bookings/${booking.id}`}
                      className="text-(--brand) hover:underline"
                    >
                      {booking.id.slice(0, 8)}
                    </a>
                  </TableCell>
                  <TableCell>
                    {booking.wasteCategory?.name ?? "Unknown"}
                  </TableCell>
                  <TableCell>{booking.actualWeightKg ?? "0"} kg</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>
                        LKR{" "}
                        {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                      </div>
                      {isUserPaymentDueStatus(booking.status) &&
                        booking.finalAmountLkr !== null &&
                        booking.finalAmountLkr !== undefined && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            Please pay LKR {booking.finalAmountLkr.toFixed(2)} to
                            driver.
                          </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={booking.status} viewerRole="CUSTOMER" />
                  </TableCell>
                  <TableCell>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {normalizeBookingStatus(booking.status) === "CREATED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(booking.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete Booking"
                        disabled={deletingId === booking.id}
                      >
                        {deletingId === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!bookings.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-(--muted)"
                  >
                    No bookings found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            nextCursor={data?.nextCursor ?? null}
            prevCursor={data?.prevCursor ?? null}
            onNext={() => { setAfterCursor(data?.nextCursor ?? null); setBeforeCursor(null); }}
            onPrev={() => { setBeforeCursor(data?.prevCursor ?? null); setAfterCursor(null); }}
            limit={limit}
            onLimitChange={(n) => { setLimit(n); setAfterCursor(null); setBeforeCursor(null); }}
            loading={isFetching}
          />
        </Card>
      )}
    </div>
  );
}
