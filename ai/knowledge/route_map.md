# Route Map

This file is generated from `server/src/chat/chat.route-map.ts` and describes key assistant-relevant routes.

## /users/dashboard
Title: User Dashboard
Description: Overview for customers with booking stats, recent activity, and shortcuts.
Allowed roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`
Actions:
- View personal booking snapshot
- Navigate to booking history or new booking flow

## /users/bookings
Title: Booking History
Description: Customer list of bookings with filters and status tracking.
Allowed roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`
Actions:
- Review booking status timeline
- Open booking detail pages

## /users/rewards
Title: User Rewards
Description: Customer points summary, monthly progress, and recent awards.
Allowed roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`
Actions:
- Check total and monthly points
- Review recent points transactions

## /users/notifications
Title: User Notifications
Description: Customer notifications feed for booking and system updates.
Allowed roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`
Actions:
- Read latest notifications
- Track booking-related alerts

## /users/pending-pickups
Title: Pending Pickups
Description: Customer-focused pending booking queue for active pickups.
Allowed roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`
Actions:
- View bookings awaiting completion
- Monitor active pickup progress

## /driver/bookings
Title: Driver Bookings
Description: Driver-assigned booking queue and execution workspace.
Allowed roles: `DRIVER`
Actions:
- View assigned bookings
- Start, collect, or cancel assigned pickups

## /driver/notifications
Title: Driver Notifications
Description: Driver alerts for assignment and pickup lifecycle events.
Allowed roles: `DRIVER`
Actions:
- Review assignment updates
- Track status change alerts

## /admin/dashboard
Title: Admin Dashboard
Description: Admin operational overview with metrics, revenue, and activity.
Allowed roles: `ADMIN`, `SUPER_ADMIN`
Actions:
- Monitor totals and trends
- Drill into bookings and operations

## /admin/bookings
Title: Admin Bookings
Description: Admin booking management for assignment, status updates, and review.
Allowed roles: `ADMIN`, `SUPER_ADMIN`
Actions:
- Assign drivers
- Update booking statuses with transition checks

## /admin/drivers
Title: Admin Drivers
Description: Admin driver management including status, approval, and profile updates.
Allowed roles: `ADMIN`, `SUPER_ADMIN`
Actions:
- View and edit drivers
- Manage operational driver readiness

## /admin/waste-management
Canonical path: `/admin/waste`
Title: Admin Waste Management
Description: Admin waste category management. In this codebase the active page path is /admin/waste.
Allowed roles: `ADMIN`, `SUPER_ADMIN`
Actions:
- Create and edit waste categories
- Manage category naming and activation

