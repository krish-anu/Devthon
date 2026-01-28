'use client';

import { LayoutGrid, History, Truck, Bell, Settings, LogOut } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navItems = [
    { label: 'Dashboard', href: '/app/dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
    { label: 'Booking History', href: '/app/bookings', icon: <History className="h-4 w-4" /> },
    { label: 'Pending Pickups', href: '/app/pending-pickups', icon: <Truck className="h-4 w-4" /> },
    { label: 'Notifications', href: '/app/notifications', icon: <Bell className="h-4 w-4" /> },
    { label: 'Profile Settings', href: '/app/profile', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <RequireAuth roles={['USER', 'ADMIN']}>
      <AppShell
        sidebar={<Sidebar title="User Portal" items={navItems} />}
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">User Portal</p>
              <h2 className="text-lg font-semibold">Welcome back, {user?.fullName?.split(' ')[0] ?? 'User'}</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        }
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}
