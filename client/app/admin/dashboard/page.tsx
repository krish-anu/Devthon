"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import Loading from "@/components/shared/Loading";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const pieColors = ["#4ade80", "#38bdf8", "#f97316", "#facc15", "#ec4899"];

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => apiFetch<any>("/admin/metrics"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <Loading message="Loading dashboard metrics..." />
        </Card>
      </div>
    );
  }

  const totals = data?.totals ?? {
    totalRevenue: 0,
    totalUsers: 0,
    activeDrivers: 0,
    pendingPickups: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={`LKR ${totals.totalRevenue.toFixed(0)}`}
        />
        <KpiCard label="Total Users" value={`${totals.totalUsers}`} />
        <KpiCard label="Active Drivers" value={`${totals.activeDrivers}`} />
        <KpiCard label="Pending Pickups" value={`${totals.pendingPickups}`} />
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="h-72 sm:h-80">
          <h3 className="text-base sm:text-lg font-semibold">
            Revenue Overview
          </h3>
          <div className="mt-3 sm:mt-4 h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.revenueByDay ?? []}>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b1220",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="revenue" fill="#4ade80" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="h-72 sm:h-80">
          <h3 className="text-base sm:text-lg font-semibold">
            Waste Types Distribution
          </h3>
          <div className="mt-3 sm:mt-4 h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.wasteDistribution ?? []}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {(data?.wasteDistribution ?? []).map(
                    (_: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b1220",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-base sm:text-lg font-semibold">Recent Activity</h3>
        <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          {(data?.recentActivity ?? []).map((activity: any) => (
            <div
              key={activity.id}
              className="flex flex-col gap-2 rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">
                  {activity.user?.fullName ?? "User"} booked{" "}
                  {activity.wasteCategory?.name}
                </p>
                <p className="text-xs text-(--muted)">
                  {new Date(activity.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-(--muted)">{activity.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
