/**
 * Returns whether a cancellation was "late" based on the business policy.
 * Returns null if there is not enough data to determine (e.g. no policy configured).
 */
export function isLateCancellation(
  cancelledAt: Date | null,
  startTime: Date,
  lateCancellationHours: number | null,
): boolean | null {
  if (!cancelledAt || !lateCancellationHours) return null;
  const deadlineMs = startTime.getTime() - lateCancellationHours * 60 * 60 * 1000;
  return cancelledAt.getTime() >= deadlineMs;
}

/**
 * Returns the fee amount for a late cancellation given the policy configuration.
 * Returns null if there is no fee or not enough info.
 */
export function computeLateCancellationFee(
  feeType: string,
  feeAmount: number | null,
  feePercentage: number | null,
  servicePrice: number,
): number | null {
  if (feeType === "fixed" && feeAmount != null && feeAmount > 0) {
    return feeAmount;
  }
  if (feeType === "percentage" && feePercentage != null && feePercentage > 0) {
    return Math.round((servicePrice * feePercentage) / 100);
  }
  return null;
}
