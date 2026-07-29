-- Admin-set monthly price override (agorot). Null = the plan's list price.
ALTER TABLE "User" ADD COLUMN     "customPriceMinor" INTEGER;
