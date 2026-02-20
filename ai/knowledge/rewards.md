# Rewards Rules

## Base Point Rates
- Plastic or PET categories: `10 pts/kg`.
- Metal or aluminum categories: `20 pts/kg`.
- Other categories: `0 pts/kg` unless configured in logic later.

## E-Waste Bonus
- If the booking includes e-waste, add `+30` bonus points per booking.

## Multipliers
- Weekly pickup streak: `2.0x`.
- First confirmed booking: `1.5x`.
- Standard: `1.0x`.

Only the highest applicable multiplier is used:
- Weekly streak has priority over first-booking bonus.

## Formula
`finalPoints = round((basePoints + bonusPoints) * multiplier)`

Where:
- `basePoints = round(sum(weightKg * categoryRate))`
- `bonusPoints = 30` when e-waste rule applies, else `0`

## Award Timing and Eligibility
- Points are awarded when booking status is `COMPLETED`.
- Award happens once per booking.
- If already awarded for the booking, no duplicate points are added.

## User Visibility
- Users can see their own totals, monthly points, and recent point transactions.
- Users cannot see other users' reward transactions.

