import { z } from "zod";

export const updateCourseSettingsSchema = z
  .object({
    paceTargetMinutes: z.number().int().min(60).max(600).optional(),
    teeIntervalMinutes: z.number().int().min(5).max(30).optional(),
    timezone: z
      .string()
      .min(1)
      .max(50)
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid IANA timezone" },
      )
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

export const assignRoleSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "marshal", "viewer"]),
});

export const roleIdParamSchema = z.object({
  courseId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type UpdateCourseSettingsInput = z.infer<typeof updateCourseSettingsSchema>;
