import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

export const getFreshByZip = internalQuery({
  args: {
    zip5: v.string(),
    countryCode: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("zipRepresentativeCache")
      .withIndex("by_zip_country", (q) =>
        q.eq("zip5", args.zip5).eq("countryCode", args.countryCode),
      )
      .first();

    if (!cached || cached.expiresAt <= args.now) {
      return null;
    }

    return cached.data;
  },
});

export const upsertByZip = internalMutation({
  args: {
    zip5: v.string(),
    countryCode: v.string(),
    data: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("zipRepresentativeCache")
      .withIndex("by_zip_country", (q) =>
        q.eq("zip5", args.zip5).eq("countryCode", args.countryCode),
      )
      .collect();

    if (existing.length === 0) {
      await ctx.db.insert("zipRepresentativeCache", {
        zip5: args.zip5,
        countryCode: args.countryCode,
        data: args.data,
        fetchedAt: args.fetchedAt,
        expiresAt: args.expiresAt,
      });
      return;
    }

    const [first, ...rest] = existing;
    await ctx.db.patch(first._id, {
      data: args.data,
      fetchedAt: args.fetchedAt,
      expiresAt: args.expiresAt,
    });

    for (const duplicate of rest) {
      await ctx.db.delete(duplicate._id);
    }
  },
});
