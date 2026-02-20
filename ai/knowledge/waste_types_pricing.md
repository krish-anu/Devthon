# Waste Types and Pricing

## Source of Truth
- Waste types come from `WasteCategory` records in the database.
- Active, user-facing waste list is returned from the Waste Types API.
- Pricing comes from `Pricing` records linked to each waste category.

## Returned Pricing Fields
- `minPriceLkrPerKg`
- `maxPriceLkrPerKg`
- `ratePerKg` (display midpoint of min and max when both exist)

## Naming and Slug Rules
- Category names are normalized to slugs for consistent matching.
- Slug normalization is used in rewards logic and waste lookup behavior.
- Naming should be human-readable and stable for UI + analytics.

## Admin Management
- Admin updates category and pricing data from admin waste/pricing pages.
- Pricing updates are upserted by `wasteCategoryId`.
- Inactive pricing should not be treated as active user pricing.

## Booking Estimates vs Final Amount
- Booking creation uses category pricing min/max and user-estimated weight to produce estimated min/max amount.
- Collected bookings can produce a computed final amount from measured weight and pricing midpoint.
- Completion requires a final amount.

## Assistant Behavior for Pricing Questions
- Prefer current DB-backed waste/pricing tool data when available.
- If no pricing configured for a category, state that directly and avoid guessing rates.

