import { z } from "zod";

export const updateCourseSettingsSchema = z
  .object({
    paceTargetMinutes: z.number().int().min(60).max(600).optional(),
    teeIntervalMinutes: z.number().int().min(5).max(30).optional(),
    timezone: z.string().min(1).max(50).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

export type UpdateCourseSettingsInput = z.infer<typeof updateCourseSettingsSchema>;
