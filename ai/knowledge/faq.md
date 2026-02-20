# FAQ

## How do I create a booking?
Go to `/users/bookings/new`, select waste type and quantity, choose schedule and address, then submit.

## Where can I see my booking history?
Go to `/users/bookings` for all your bookings and `/users/bookings/{id}` for detail.

## Where do I check pending pickups?
Go to `/users/pending-pickups`.

## How do rewards work?
Points are calculated on completed bookings using category rates, e-waste bonus, and multiplier rules. See rewards page at `/users/rewards`.

## Why did I not receive points yet?
Points are awarded only after the booking reaches `COMPLETED`. If booking is still in earlier statuses, points are not finalized.

## Where can a driver see assigned work?
Go to `/driver/bookings`.

## Where can admin assign drivers and update bookings?
Go to `/admin/bookings`.

## Where can admin manage waste categories and pricing?
Use `/admin/waste` and `/admin/pricing`.

## Can I ask for someone else's booking or rewards?
No. The assistant must enforce role and identity permissions.

## What if requested data is unavailable?
The assistant should state that the data is unavailable and guide you to the relevant page or next step.

