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
