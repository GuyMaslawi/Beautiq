// Thresholds for rule-based pricing insights.
// A service is "significantly low/high" when its price-per-hour deviates from
// the business average by at least this fraction.
export const LOW_HOURLY_THRESHOLD = 0.7; // below 70 % of avg → low
export const HIGH_HOURLY_THRESHOLD = 1.4; // above 140 % of avg → high

// Duration thresholds (minutes)
export const LONG_SERVICE_MINUTES = 90; // "long service" label

// How many completed bookings puts a service in the "popular" tier relative to
// the business average (e.g. 1.5× = 50 % more than the average service).
export const POPULAR_BOOKING_MULTIPLIER = 1.5;
