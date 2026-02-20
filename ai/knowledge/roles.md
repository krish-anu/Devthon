# Roles and Permissions

## Role Mapping
- USER in product language maps to backend role `CUSTOMER`.
- DRIVER maps to backend role `DRIVER`.
- ADMIN maps to backend roles `ADMIN` and `SUPER_ADMIN`.

## USER (`CUSTOMER`)
Allowed:
- Create bookings.
- View own booking history and booking details.
- View own reward totals and transactions.
- View own notifications.
- Cancel own bookings when allowed by workflow rules.

Not allowed:
- View other users' bookings, points, or notifications.
- View all-bookings operational admin dashboards.
- Access driver-only assigned pickup lists.

## DRIVER (`DRIVER`)
Allowed:
- View bookings assigned to the current driver account only.
- Start pickup (`IN_PROGRESS`), collect (`COLLECTED`), or cancel assigned bookings.
- Update own driver status (`ONLINE`/`OFFLINE`).
- View driver notifications.

Not allowed:
- View unassigned bookings or bookings assigned to other drivers.
- Mark booking as `COMPLETED` (admin action).
- Access admin user/pricing/waste management operations.

## ADMIN (`ADMIN`, `SUPER_ADMIN`)
Allowed:
- View and manage bookings across the system.
- Assign drivers to bookings.
- Update booking statuses with transition validation.
- Manage waste categories and pricing.
- Manage users and drivers.
- View operational metrics and summaries.

Additional `SUPER_ADMIN` capabilities:
- Approval workflows.
- Role management operations.

## Permission Safety Rules for Assistant Responses
- Never reveal cross-user private data to non-admin roles.
- Treat "my data" as data scoped to authenticated requester only.
- If the requester is unauthenticated, do not return personal data.
- If a role asks for restricted data, refuse and suggest an allowed page.

