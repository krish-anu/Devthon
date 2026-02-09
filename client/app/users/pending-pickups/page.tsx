"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Booking } from "@/lib/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PendingPickupsPage() {
  const { data } = useQuery({
    queryKey: ["pending-pickups"],
    queryFn: () => apiFetch<Booking[]>("/pickups/pending"),
  });

  const pickups = data ?? [];

  // Filter state
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [fromTime, setFromTime] = useState<string>("");
  const [toTime, setToTime] = useState<string>("");

  // Generate hourly time options (24h)
  const timeOptions = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      arr.push(`${hh}:00`);
    }
    return arr;
  }, []);

  // client-side filtering so UI works immediately
  const filtered = useMemo(() => {
    return pickups.filter((p) => {
      // date compare (YYYY-MM-DD)
      const scheduled = new Date(p.scheduledDate);
      const scheduledDateStr = scheduled.toISOString().slice(0, 10);

      if (fromDate && scheduledDateStr < fromDate) return false;
      if (toDate && scheduledDateStr > toDate) return false;

      // time compare — use start of time slot if available
      const slot = (p.scheduledTimeSlot || "").toString();
      const start = slot.includes("-")
        ? slot.split("-")[0].trim()
        : slot.trim();
      // normalize to HH:MM
      const startTime =
        start.length === 4 && start[2] === ":" ? `0${start}` : start;

      if (fromTime && startTime && startTime < fromTime) return false;
      if (toTime && startTime && startTime > toTime) return false;

      return true;
    });
  }, [pickups, fromDate, toDate, fromTime, toTime]);

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setFromTime("");
    setToTime("");
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap gap-3 p-4">
        <div className="flex flex-col gap-2 w-full md:flex-row md:items-end md:gap-4">
          <div className="flex flex-col">
            <label className="text-xs text-(--muted)">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11 rounded-xl border px-4 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-(--muted)">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11 rounded-xl border px-4 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-(--muted)">From time</label>
            <select
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className="h-11 rounded-xl border px-4 text-sm"
            >
              <option value="">From</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-(--muted)">To time</label>
            <select
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="h-11 rounded-xl border px-4 text-sm"
            >
              <option value="">To</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="h-11 rounded-xl border px-4 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time Slot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((pickup) => (
              <TableRow key={pickup.id}>
                <TableCell>{pickup.id.slice(0, 8)}</TableCell>
                <TableCell>
                  {pickup.driver?.fullName ?? "Assigned soon"}
                </TableCell>
                <TableCell>{pickup.driver?.phone ? formatPhoneForDisplay(pickup.driver.phone) : "--"}</TableCell>
                <TableCell>{pickup.addressLine1}</TableCell>
                <TableCell>
                  {new Date(pickup.scheduledDate).toLocaleDateString()}
                </TableCell>
                <TableCell>{pickup.scheduledTimeSlot}</TableCell>
              </TableRow>
            ))}
            {!pickups.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-(--muted)">
                  No pending pickups.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
