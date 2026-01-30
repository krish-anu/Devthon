"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";

export default function AdminDriversPage() {
  const { data } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => apiFetch<any[]>("/admin/drivers"),
  });

  const drivers = data ?? [];
  const stats = useMemo(() => {
    const online = drivers.filter((d) => d.status === "ONLINE").length;
    const onPickup = drivers.filter((d) => d.status === "ON_PICKUP").length;
    const offline = drivers.filter((d) => d.status === "OFFLINE").length;
    return { total: drivers.length, online, onPickup, offline };
  }, [drivers]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Drivers" value={`${stats.total}`} />
        <KpiCard label="Online Now" value={`${stats.online}`} />
        <KpiCard label="On Pickup" value={`${stats.onPickup}`} />
        <KpiCard label="Offline" value={`${stats.offline}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {drivers.map((driver) => (
          <Card key={driver.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{driver.name}</h3>
              <span className="rounded-full border border-(--border) bg-(--surface) px-3 py-1 text-xs text-(--muted)">
                {driver.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-(--muted)">Rating: {driver.rating} ?</p>
            <p className="text-sm text-(--muted)">
              Pickup count: {driver.pickupCount}
            </p>
            <p className="text-sm text-(--muted)">
              Vehicle: {driver.vehicleType}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
