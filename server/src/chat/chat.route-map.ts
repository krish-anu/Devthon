import { Role } from '@prisma/client';
import { SuggestedAction } from './chat.types';

export type RouteRole = Role | 'GUEST';

export type WebsiteRouteEntry = {
  path: string;
  canonicalPath?: string;
  title: string;
  description: string;
  actions: string[];
  allowedRoles: RouteRole[];
};

export const WEBSITE_ROUTE_MAP: WebsiteRouteEntry[] = [
  {
    path: '/users/dashboard',
    title: 'User Dashboard',
    description:
      'Overview for customers with booking stats, recent activity, and shortcuts.',
    actions: [
      'View personal booking snapshot',
      'Navigate to booking history or new booking flow',
    ],
    allowedRoles: [Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/users/bookings',
    title: 'Booking History',
    description: 'Customer list of bookings with filters and status tracking.',
    actions: ['Review booking status timeline', 'Open booking detail pages'],
    allowedRoles: [Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/users/rewards',
    title: 'User Rewards',
    description:
      'Customer points summary, monthly progress, and recent awards.',
    actions: [
      'Check total and monthly points',
      'Review recent points transactions',
    ],
    allowedRoles: [Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/users/notifications',
    title: 'User Notifications',
    description: 'Customer notifications feed for booking and system updates.',
    actions: ['Read latest notifications', 'Track booking-related alerts'],
    allowedRoles: [Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/users/pending-pickups',
    title: 'Pending Pickups',
    description: 'Customer-focused pending booking queue for active pickups.',
    actions: [
      'View bookings awaiting completion',
      'Monitor active pickup progress',
    ],
    allowedRoles: [Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/driver/bookings',
    title: 'Driver Bookings',
    description: 'Driver-assigned booking queue and execution workspace.',
    actions: [
      'View assigned bookings',
      'Start, collect, or cancel assigned pickups',
    ],
    allowedRoles: [Role.DRIVER],
  },
  {
    path: '/driver/notifications',
    title: 'Driver Notifications',
    description: 'Driver alerts for assignment and pickup lifecycle events.',
    actions: ['Review assignment updates', 'Track status change alerts'],
    allowedRoles: [Role.DRIVER],
  },
  {
    path: '/admin/dashboard',
    title: 'Admin Dashboard',
    description:
      'Admin operational overview with metrics, revenue, and activity.',
    actions: [
      'Monitor totals and trends',
      'Drill into bookings and operations',
    ],
    allowedRoles: [Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/admin/bookings',
    title: 'Admin Bookings',
    description:
      'Admin booking management for assignment, status updates, and review.',
    actions: [
      'Assign drivers',
      'Update booking statuses with transition checks',
    ],
    allowedRoles: [Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/admin/drivers',
    title: 'Admin Drivers',
    description:
      'Admin driver management including status, approval, and profile updates.',
    actions: ['View and edit drivers', 'Manage operational driver readiness'],
    allowedRoles: [Role.ADMIN, Role.SUPER_ADMIN],
  },
  {
    path: '/admin/waste-management',
    canonicalPath: '/admin/waste',
    title: 'Admin Waste Management',
    description:
      'Admin waste category management. In this codebase the active page path is /admin/waste.',
    actions: [
      'Create and edit waste categories',
      'Manage category naming and activation',
    ],
    allowedRoles: [Role.ADMIN, Role.SUPER_ADMIN],
  },
];

export function getCanonicalPath(route: WebsiteRouteEntry) {
  return route.canonicalPath ?? route.path;
}

export function routeMatchesRole(route: WebsiteRouteEntry, role: RouteRole) {
  return route.allowedRoles.includes(role);
}

export function listActionsForRole(
  role: RouteRole,
  limit = 6,
): SuggestedAction[] {
  const actions = WEBSITE_ROUTE_MAP.filter((route) =>
    routeMatchesRole(route, role),
  ).map((route) => ({
    label: route.title,
    href: getCanonicalPath(route),
  }));

  return actions.slice(0, Math.max(1, limit));
}

export function generateRouteMapMarkdown() {
  const lines: string[] = [];
  lines.push('# Route Map');
  lines.push('');
  lines.push(
    'This file is generated from `server/src/chat/chat.route-map.ts` and describes key assistant-relevant routes.',
  );
  lines.push('');

  for (const route of WEBSITE_ROUTE_MAP) {
    lines.push(`## ${route.path}`);
    if (route.canonicalPath && route.canonicalPath !== route.path) {
      lines.push(`Canonical path: \`${route.canonicalPath}\``);
    }
    lines.push(`Title: ${route.title}`);
    lines.push(`Description: ${route.description}`);
    lines.push(
      `Allowed roles: ${route.allowedRoles
        .map((role) => `\`${role}\``)
        .join(', ')}`,
    );
    lines.push('Actions:');
    for (const action of route.actions) {
      lines.push(`- ${action}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
