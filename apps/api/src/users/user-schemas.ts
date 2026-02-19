import { z } from "zod";

export const updatePrefsSchema = z
  .object({
    paceReminders: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one preference field must be provided",
  });
