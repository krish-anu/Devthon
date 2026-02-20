"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Pagination from "@/components/ui/pagination";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import Skeleton, { SkeletonGrid } from "@/components/shared/Skeleton";

type DriverListItem = {
  id: string;
  fullName: string;
  status: "ONLINE" | "OFFLINE" | "ON_PICKUP" | string;
  rating?: number | null;
  pickupCount?: number | null;
  vehicle?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
};

type DriverListResponse = {
  items: DriverListItem[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export default function AdminDriversPage() {
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(10);

  const { data, isLoading, isFetching } = useQuery<DriverListResponse>({
    queryKey: ["admin-drivers", afterCursor, beforeCursor, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("limit", String(limit));
      if (afterCursor) params.append("after", afterCursor);
      if (beforeCursor) params.append("before", beforeCursor);
      return apiFetch<DriverListResponse>(
        `/admin/drivers?${params.toString()}`,
      );
    },
    refetchInterval: 15000,
    placeholderData: (previousData) => previousData,
  });

  const drivers = data?.items ?? [];

  useEffect(() => {
    setAfterCursor(null);
    setBeforeCursor(null);
  }, []);
  const stats = useMemo(() => {
    const online = drivers.filter((d) => d.status === "ONLINE").length;
    const onPickup = drivers.filter((d) => d.status === "ON_PICKUP").length;
    const offline = drivers.filter((d) => d.status === "OFFLINE").length;
    return { total: drivers.length, online, onPickup, offline };
  }, [drivers]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard label="Total Drivers" value={`${stats.total}`} />
        <KpiCard label="Online Now" value={`${stats.online}`} />
        <KpiCard label="On Pickup" value={`${stats.onPickup}`} />
        <KpiCard label="Offline" value={`${stats.offline}`} />
      </div>

      {isLoading ? (
        <Card className="p-6">
          <SkeletonGrid count={6} cardClass="h-28" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {drivers.map((driver) => (
              <Card key={driver.id} className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={driver.avatarUrl ?? driver.avatar ?? null}
                      alt={driver.fullName ?? "Driver"}
                      className="h-10 w-10"
                    />
                    <h3 className="text-lg font-semibold break-words">
                      {driver.fullName}
                    </h3>
                  </div>
                  <span className="rounded-full border border-(--border) bg-(--surface) px-3 py-1 text-xs text-(--muted)">
                    {driver.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-(--muted)">
                  Rating: {driver.rating} ?
                </p>
                <p className="text-sm text-(--muted)">
                  Pickup count: {driver.pickupCount}
                </p>
                <p className="text-sm text-(--muted)">
                  Vehicle: {driver.vehicle}
                </p>
              </Card>
            ))}
          </div>

          <Pagination
            nextCursor={data?.nextCursor ?? null}
            prevCursor={data?.prevCursor ?? null}
            onNext={() => {
              setAfterCursor(data?.nextCursor ?? null);
              setBeforeCursor(null);
            }}
            onPrev={() => {
              setBeforeCursor(data?.prevCursor ?? null);
              setAfterCursor(null);
            }}
            limit={limit}
            onLimitChange={(n) => {
              setLimit(n);
              setAfterCursor(null);
              setBeforeCursor(null);
            }}
            loading={isFetching}
          />
        </>
      )}
    </div>
  );
}
