'use client';

import { LayoutGrid, Users, Truck, ClipboardList, Tag, LogOut } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { AppShell } from '@/components/layout/app-shell';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
    { label: 'Users', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
    { label: 'Drivers', href: '/admin/drivers', icon: <Truck className="h-4 w-4" /> },
    { label: 'Bookings', href: '/admin/bookings', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Pricing', href: '/admin/pricing', icon: <Tag className="h-4 w-4" /> },
  ];

  return (
    <RequireAuth roles={['ADMIN']}>
      <AppShell
        sidebar={<Sidebar title="Admin Portal" items={navItems} />}
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Admin Console</p>
              <h2 className="text-lg font-semibold">Welcome, {user?.fullName ?? 'Admin'}</h2>
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
