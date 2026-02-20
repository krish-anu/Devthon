# Booking Lifecycle

## Canonical Statuses
- `CREATED`: booking was submitted by user and awaits assignment.
- `ASSIGNED`: driver assigned.
- `IN_PROGRESS`: driver started pickup.
- `COLLECTED`: pickup collected and measured.
- `COMPLETED`: admin finalized booking and confirmed final amount.
- `CANCELLED`: booking stopped.
- `REFUNDED`: refunded after cancellation.

## Legacy Status Normalization
- `SCHEDULED` is treated as `CREATED`.
- `PAID` is treated as `COLLECTED`.

## Standard Transition Path
`CREATED -> ASSIGNED -> IN_PROGRESS -> COLLECTED -> COMPLETED`

Cancellation path:
- `CREATED/ASSIGNED/IN_PROGRESS/COLLECTED -> CANCELLED -> REFUNDED`

## Role-Based Transition Rules
Admin:
- Can move `CREATED -> ASSIGNED` and handle cancellation/refund flow.
- Can move `COLLECTED -> COMPLETED`.
- Cannot bypass required state and validation checks.

Driver:
- Can move `ASSIGNED -> IN_PROGRESS`.
- Can move `IN_PROGRESS -> COLLECTED`.
- Can cancel assigned bookings in allowed stages.
- Cannot mark bookings as `COMPLETED`.

User:
- Can create and cancel own booking (subject to backend checks).
- Cannot update internal operational statuses directly.

## Completion Rules
- Booking must have collected weight and final amount before completion.
- Points are awarded only after status becomes `COMPLETED`.
- Points are awarded once per booking (deduplicated by booking ID).

## What Each Role Sees
- User views own booking timeline only.
- Driver views only assigned bookings.
- Admin views organization-wide booking pipeline.

