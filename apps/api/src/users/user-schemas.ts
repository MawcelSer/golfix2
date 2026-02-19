import { z } from "zod";

export const updatePrefsSchema = z.object({
  paceReminders: z.boolean().optional(),
});
