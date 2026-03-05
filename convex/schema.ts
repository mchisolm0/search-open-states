import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  zipRepresentativeCache: defineTable({
    zip5: v.string(),
    countryCode: v.string(),
    data: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_zip_country", ["zip5", "countryCode"]),
});
