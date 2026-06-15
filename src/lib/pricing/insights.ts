import { PRICING } from "@/lib/constants/he";
import {
  LOW_HOURLY_THRESHOLD,
  HIGH_HOURLY_THRESHOLD,
  LONG_SERVICE_MINUTES,
  POPULAR_BOOKING_MULTIPLIER,
} from "@/lib/pricing/constants";

export type InsightType =
  | "low_hourly_value"
  | "high_hourly_value"
  | "long_low_price"
  | "popular_service"
  | "below_range"
  | "within_range"
  | "above_range";

export interface PricingInsight {
  type: InsightType;
  title: string;
  body: string;
  severity: "warning" | "info" | "positive";
}

export interface ServiceInsightInput {
  durationMinutes: number;
  price: number;
  completedBookingCount: number;
  marketMinPrice: number | null;
  marketAveragePrice: number | null;
  marketMaxPrice: number | null;
}

export function calcPricePerHour(price: number, durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  return (price / durationMinutes) * 60;
}

export function calcBusinessAvgPricePerHour(
  services: Array<{ price: number; durationMinutes: number }>,
): number {
  if (services.length === 0) return 0;
  const total = services.reduce(
    (sum, s) => sum + calcPricePerHour(s.price, s.durationMinutes),
    0,
  );
  return total / services.length;
}

export function calcBusinessAvgCompletedBookings(
  counts: number[],
): number {
  if (counts.length === 0) return 0;
  return counts.reduce((a, b) => a + b, 0) / counts.length;
}

export function generateServiceInsights(
  service: ServiceInsightInput,
  businessAvgPricePerHour: number,
  businessAvgCompletedBookings: number,
): PricingInsight[] {
  const insights: PricingInsight[] = [];
  const pph = calcPricePerHour(service.price, service.durationMinutes);

  // A. Market range comparison (takes priority over internal comparisons if present)
  if (service.marketMinPrice !== null && service.marketMaxPrice !== null) {
    if (service.price < service.marketMinPrice) {
      insights.push({
        type: "below_range",
        title: PRICING.insights.belowRange.title,
        body: PRICING.insights.belowRange.body,
        severity: "warning",
      });
    } else if (service.price > service.marketMaxPrice) {
      insights.push({
        type: "above_range",
        title: PRICING.insights.aboveRange.title,
        body: PRICING.insights.aboveRange.body,
        severity: "info",
      });
    } else {
      insights.push({
        type: "within_range",
        title: PRICING.insights.withinRange.title,
        body: PRICING.insights.withinRange.body,
        severity: "positive",
      });
    }
  }

  // B. Long service with low price — most actionable, show before generic low/high
  if (
    service.durationMinutes >= LONG_SERVICE_MINUTES &&
    businessAvgPricePerHour > 0 &&
    pph < businessAvgPricePerHour
  ) {
    insights.push({
      type: "long_low_price",
      title: PRICING.insights.longLowPrice.title,
      body: PRICING.insights.longLowPrice.body,
      severity: "warning",
    });
  } else if (businessAvgPricePerHour > 0) {
    // C. Low hourly value (not already captured by long_low_price)
    if (pph < businessAvgPricePerHour * LOW_HOURLY_THRESHOLD) {
      insights.push({
        type: "low_hourly_value",
        title: PRICING.insights.lowHourlyValue.title,
        body: PRICING.insights.lowHourlyValue.body,
        severity: "warning",
      });
    }
    // D. High hourly value
    else if (pph > businessAvgPricePerHour * HIGH_HOURLY_THRESHOLD) {
      insights.push({
        type: "high_hourly_value",
        title: PRICING.insights.highHourlyValue.title,
        body: PRICING.insights.highHourlyValue.body,
        severity: "info",
      });
    }
  }

  // F. Popular service
  if (
    businessAvgCompletedBookings > 0 &&
    service.completedBookingCount >= businessAvgCompletedBookings * POPULAR_BOOKING_MULTIPLIER
  ) {
    insights.push({
      type: "popular_service",
      title: PRICING.insights.popularService.title,
      body: PRICING.insights.popularService.body,
      severity: "info",
    });
  }

  return insights;
}

export function hasPricingConcerns(
  services: ServiceInsightInput[],
  businessAvgPricePerHour: number,
  businessAvgCompletedBookings: number,
): boolean {
  return services.some((s) => {
    const insights = generateServiceInsights(s, businessAvgPricePerHour, businessAvgCompletedBookings);
    return insights.some(
      (i) =>
        i.type === "low_hourly_value" ||
        i.type === "long_low_price" ||
        i.type === "below_range",
    );
  });
}
