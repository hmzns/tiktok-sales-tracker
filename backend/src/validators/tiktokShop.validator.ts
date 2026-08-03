import { z } from "zod";

export const syncTikTokOrdersSchema = z.preprocess(
  (value) => value ?? {},
  z
    .object({
      days: z
        .number()
        .int("Days must be a whole number")
        .min(1, "Days must be at least 1")
        .max(30, "Days must be at most 30")
        .optional()
        .default(7),
    })
    .strict()
);

const syncHistoryLimitSchema = z.preprocess(
  (value) => {
    if (value === undefined) {
      return 10;
    }

    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }

    return value;
  },
  z
    .number()
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(50, "Limit must be at most 50")
);

export const tikTokSyncHistoryQuerySchema = z
  .object({
    limit: syncHistoryLimitSchema,
  })
  .strict();
