import { z } from "zod";

export const reminderParamsSchema = z.object({
  courseId: z.string().uuid(),
  groupId: z.string().uuid(),
});

export const reminderBodySchema = z.object({
  message: z.string().max(500).optional(),
});
