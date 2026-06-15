import { Prisma } from "@prisma/client";

/**
 * Lightweight test factories. Each returns a plain object shaped like the Prisma
 * row, with sensible defaults that can be overridden per-test. These are NOT
 * persisted — they feed the Prisma mock's return values.
 *
 * Two business ids are provided as constants so cross-tenant tests can clearly
 * express "Business A" vs "Business B".
 */

export const BUSINESS_A = "biz_aaaaaaaaaaaaaaaaaaaaaaaa";
export const BUSINESS_B = "biz_bbbbbbbbbbbbbbbbbbbbbbbb";

let seq = 0;
function id(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq.toString().padStart(6, "0")}`;
}

export function makeBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: BUSINESS_A,
    name: "סטודיו יופי",
    slug: "studio-yofi",
    description: null,
    phone: "+972501234567",
    city: "תל אביב",
    area: null,
    addressNote: null,
    instagramUrl: null,
    facebookUrl: null,
    introMessage: null,
    logoUrl: null,
    coverImageUrl: null,
    brandColor: null,
    showServices: true,
    showPrices: true,
    showHours: true,
    showReviews: true,
    showGallery: true,
    showCancellationPolicy: true,
    showPhone: true,
    showAddress: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: id("svc"),
    businessId: BUSINESS_A,
    name: "מניקור ג'ל",
    description: null,
    durationMinutes: 60,
    price: new Prisma.Decimal(150),
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
    categoryKey: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: id("cli"),
    businessId: BUSINESS_A,
    fullName: "דנה כהן",
    phone: "050-123-4567",
    normalizedPhone: "+972501234567",
    notes: null,
    whatsappOptIn: true,
    marketingOptIn: true,
    unsubscribedAt: null,
    totalCompletedBookings: 0,
    totalRevenue: new Prisma.Decimal(0),
    lastVisitAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: id("bkg"),
    businessId: BUSINESS_A,
    clientId: id("cli"),
    serviceId: id("svc"),
    startTime: new Date("2026-07-01T09:00:00Z"),
    endTime: new Date("2026-07-01T10:00:00Z"),
    status: "approved",
    source: "manual",
    priceSnapshot: new Prisma.Decimal(150),
    durationMinutesSnapshot: 60,
    notes: null,
    completedAt: null,
    cancelledAt: null,
    noShowAt: null,
    lateCancellationFeeStatus: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeWhatsAppConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: id("wac"),
    businessId: BUSINESS_A,
    provider: "meta_cloud_api",
    status: "active",
    phoneNumberId: "phone_123",
    phoneNumber: "+972500000000",
    displayPhoneNumber: "+972500000000",
    wabaId: "waba_123",
    accessTokenEncrypted: null,
    useEnvFallback: true,
    lastVerifiedAt: new Date("2026-06-01T00:00:00Z"),
    lastError: null,
    connectedAt: new Date("2026-06-01T00:00:00Z"),
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: id("usr"),
    email: "owner@example.com",
    name: "בעלת העסק",
    passwordHash: "$2a$10$hashhashhashhashhashhash",
    isAdmin: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
