import { AVAILABILITY } from "@/lib/constants/he";
import { timeToMinutes } from "@/lib/time";
import type { AvailabilityExceptionType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Weekly rules
// ---------------------------------------------------------------------------

export interface DayInput {
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

export interface ValidatedDayRule {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export type DayFieldErrors = { startTime?: string; endTime?: string };

export type WeeklyValidationResult =
  | { ok: true; rules: ValidatedDayRule[] }
  | { ok: false; dayErrors: Partial<Record<number, DayFieldErrors>> };

export function validateWeeklyRules(days: DayInput[]): WeeklyValidationResult {
  const dayErrors: Partial<Record<number, DayFieldErrors>> = {};
  const rules: ValidatedDayRule[] = [];

  days.forEach((day, weekday) => {
    if (!day.isOpen) return;

    const fieldErrors: DayFieldErrors = {};
    const start = day.startTime.trim();
    const end = day.endTime.trim();

    if (!start) fieldErrors.startTime = AVAILABILITY.errors.startRequired;
    if (!end) fieldErrors.endTime = AVAILABILITY.errors.endRequired;

    if (fieldErrors.startTime || fieldErrors.endTime) {
      dayErrors[weekday] = fieldErrors;
      return;
    }

    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);

    if (startMins === null) fieldErrors.startTime = AVAILABILITY.errors.invalidTime;
    if (endMins === null) fieldErrors.endTime = AVAILABILITY.errors.invalidTime;

    if (fieldErrors.startTime || fieldErrors.endTime) {
      dayErrors[weekday] = fieldErrors;
      return;
    }

    if (endMins! <= startMins!) {
      dayErrors[weekday] = { endTime: AVAILABILITY.errors.endBeforeStart };
      return;
    }

    rules.push({ weekday, startMinutes: startMins!, endMinutes: endMins! });
  });

  if (Object.keys(dayErrors).length > 0) return { ok: false, dayErrors };
  return { ok: true, rules };
}

// ---------------------------------------------------------------------------
// Availability exceptions
// ---------------------------------------------------------------------------

export interface ExceptionInput {
  date: string;
  type: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export type ExceptionFieldErrors = {
  date?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
};

export interface ValidatedException {
  date: Date;
  type: AvailabilityExceptionType;
  startMinutes?: number;
  endMinutes?: number;
  reason?: string;
}

export type ExceptionValidationResult =
  | { ok: true; value: ValidatedException }
  | { ok: false; errors: ExceptionFieldErrors };

export function validateException(raw: ExceptionInput): ExceptionValidationResult {
  const errors: ExceptionFieldErrors = {};

  const dateStr = raw.date.trim();
  if (!dateStr) errors.date = AVAILABILITY.errors.dateRequired;

  const typeStr = raw.type.trim();
  if (!typeStr || (typeStr !== "closed" && typeStr !== "custom_hours")) {
    errors.type = AVAILABILITY.errors.typeRequired;
  }

  let startMinutes: number | undefined;
  let endMinutes: number | undefined;

  if (typeStr === "custom_hours") {
    const start = raw.startTime.trim();
    const end = raw.endTime.trim();

    if (!start) {
      errors.startTime = AVAILABILITY.errors.startRequired;
    } else {
      const mins = timeToMinutes(start);
      if (mins === null) errors.startTime = AVAILABILITY.errors.invalidTime;
      else startMinutes = mins;
    }

    if (!end) {
      errors.endTime = AVAILABILITY.errors.endRequired;
    } else {
      const mins = timeToMinutes(end);
      if (mins === null) errors.endTime = AVAILABILITY.errors.invalidTime;
      else endMinutes = mins;
    }

    if (startMinutes !== undefined && endMinutes !== undefined && endMinutes <= startMinutes) {
      errors.endTime = AVAILABILITY.errors.endBeforeStart;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: new Date(dateStr),
      type: typeStr as AvailabilityExceptionType,
      startMinutes,
      endMinutes,
      reason: raw.reason.trim() || undefined,
    },
  };
}
