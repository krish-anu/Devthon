"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export default function AdminBookingsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "thisMonth">("all");

  const queryClient = useQueryClient();

  // Mutation to delete booking
  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => {
      alert("Failed to delete booking.");
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(id);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", status, search, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);

      // Add date filter for "This Month"
      if (dateFilter === "thisMonth") {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        params.append("from", firstDay.toISOString().split("T")[0]);
        params.append("to", lastDay.toISOString().split("T")[0]);
      }

      return apiFetch<any[]>(`/admin/bookings?${params.toString()}`);
    },
  });

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3">
        {/* ... (existing filters) */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={
              dateFilter === "all" && status === "" ? "default" : "outline"
            }
            size="sm"
            onClick={() => {
              setDateFilter("all");
              setStatus("");
            }}
          >
            All Status
          </Button>
          <Button
            variant={dateFilter === "thisMonth" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateFilter("thisMonth")}
          >
            This Month
          </Button>
          {["SCHEDULED", "COMPLETED", "CANCELLED", "REFUNDED"].map(
            (statusOption) => (
              <Button
                key={statusOption}
                variant={
                  status === statusOption && dateFilter === "all"
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  setStatus(statusOption);
                  setDateFilter("all");
                }}
              >
                {statusOption}
              </Button>
            ),
          )}
        </div>
        <Input
          placeholder="Search bookings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonTableRows columns={9} rows={6} />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id.slice(0, 8)}</TableCell>
                  <TableCell>{booking.user?.fullName ?? "--"}</TableCell>
                  <TableCell>{booking.wasteCategory?.name ?? "--"}</TableCell>
                  <TableCell>{booking.actualWeightKg ?? "-"} kg</TableCell>
                  <TableCell>
                    LKR {booking.finalAmountLkr ?? booking.estimatedMaxAmount}
                  </TableCell>
                  <TableCell>
                    {booking.driver?.fullName ?? "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={booking.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(booking.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete Booking"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
