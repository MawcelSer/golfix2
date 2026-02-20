import { db } from "../db/connection";
import { courses, courseRoles, users } from "../db/schema/core";
import { eq, and } from "drizzle-orm";

export class CourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course ${courseId} not found`);
    this.name = "CourseNotFoundError";
  }
}

export class RoleConflictError extends Error {
  constructor() {
    super("User already has a role on this course");
    this.name = "RoleConflictError";
  }
}

export class UserNotFoundByEmailError extends Error {
  constructor(email: string) {
    super(`User with email ${email} not found`);
    this.name = "UserNotFoundByEmailError";
  }
}

export class LastOwnerError extends Error {
  constructor() {
    super("Cannot remove the last owner");
    this.name = "LastOwnerError";
  }
}

// ── Course settings ──────────────────────────────────────────────────

export async function updateCourseSettings(
  courseId: string,
  update: { paceTargetMinutes?: number; teeIntervalMinutes?: number; timezone?: string },
) {
  const [updated] = await db.update(courses).set(update).where(eq(courses.id, courseId)).returning({
    id: courses.id,
    paceTargetMinutes: courses.paceTargetMinutes,
    teeIntervalMinutes: courses.teeIntervalMinutes,
    timezone: courses.timezone,
  });
  if (!updated) throw new CourseNotFoundError(courseId);
  return updated;
}

// ── Role management ──────────────────────────────────────────────────

export async function listCourseRoles(courseId: string) {
  return db
    .select({
      id: courseRoles.id,
      userId: courseRoles.userId,
      role: courseRoles.role,
      user: {
        email: users.email,
        displayName: users.displayName,
      },
    })
    .from(courseRoles)
    .innerJoin(users, eq(courseRoles.userId, users.id))
    .where(eq(courseRoles.courseId, courseId));
}

export async function assignCourseRole(courseId: string, email: string, role: string) {
  // Find user by email
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) throw new UserNotFoundByEmailError(email);

  // Check for existing role
  const [existing] = await db
    .select({ id: courseRoles.id })
    .from(courseRoles)
    .where(and(eq(courseRoles.userId, user.id), eq(courseRoles.courseId, courseId)));
  if (existing) throw new RoleConflictError();

  const [created] = await db
    .insert(courseRoles)
    .values({ userId: user.id, courseId, role: role as "owner" | "admin" | "marshal" | "viewer" })
    .returning({
      id: courseRoles.id,
      userId: courseRoles.userId,
      courseId: courseRoles.courseId,
      role: courseRoles.role,
    });

  return created!;
}

export async function removeCourseRole(roleId: string, courseId: string) {
  await db.transaction(async (tx) => {
    // Lock the role row to prevent concurrent modifications
    const [role] = await tx
      .select({ role: courseRoles.role })
      .from(courseRoles)
      .where(eq(courseRoles.id, roleId));

    if (!role) return; // Already deleted

    if (role.role === "owner") {
      // Count owners with a locked read to prevent TOCTOU
      const owners = await tx
        .select({ id: courseRoles.id })
        .from(courseRoles)
        .where(and(eq(courseRoles.courseId, courseId), eq(courseRoles.role, "owner")));
      if (owners.length <= 1) throw new LastOwnerError();
    }

    await tx.delete(courseRoles).where(eq(courseRoles.id, roleId));
  });
}
