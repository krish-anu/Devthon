# Trash2Treasure Overview

## Purpose
Trash2Treasure is a role-based waste pickup platform where people can book waste collection, drivers perform pickups, and admins manage operations, pricing, and categories.

## Primary Roles
- USER (system role: `CUSTOMER`): creates and tracks pickups, earns reward points.
- DRIVER (system role: `DRIVER`): handles assigned pickups and updates pickup progress.
- ADMIN (system roles: `ADMIN`, `SUPER_ADMIN`): manages bookings, assignment, pricing, waste categories, users, and approvals.

## Core Workflows
- Booking flow: user creates booking -> admin assigns driver -> driver collects -> admin completes.
- Rewards flow: points are calculated when a booking is marked `COMPLETED`.
- Pricing flow: waste category pricing is configured in admin tools and stored in database tables.

## Key Data Objects
- `Booking`: pickup request with status, schedule, category, and pricing estimate.
- `WasteCategory` + `Pricing`: category definitions and min/max rate configuration.
- `PointsTransaction`: immutable record of awarded reward points per completed booking.
- `Notification`: user-facing activity and status alerts.

## Status Model (Canonical)
`CREATED -> ASSIGNED -> IN_PROGRESS -> COLLECTED -> COMPLETED`

Other terminal and post-terminal states:
- `CANCELLED`
- `REFUNDED` (from cancelled)

Legacy statuses are normalized in server logic:
- `SCHEDULED` behaves as `CREATED`
- `PAID` behaves as `COLLECTED`

## Privacy and Access Principles
- Users can only see their own bookings, rewards, and notifications.
- Drivers can only see bookings assigned to their own driver account.
- Admins can view system-wide operations but should use summaries where possible instead of dumping raw sensitive data.

