import { describe, expect, it } from "vitest";
import { reminderParamsSchema, reminderBodySchema } from "../reminder-schemas";

// Test schemas
describe("reminder schemas", () => {
  describe("reminderParamsSchema", () => {
    it("accepts valid UUIDs", () => {
      const result = reminderParamsSchema.safeParse({
        courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        groupId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid courseId", () => {
      const result = reminderParamsSchema.safeParse({
        courseId: "not-a-uuid",
        groupId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing groupId", () => {
      const result = reminderParamsSchema.safeParse({
        courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reminderBodySchema", () => {
    it("accepts empty body", () => {
      const result = reminderBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts optional message", () => {
      const result = reminderBodySchema.safeParse({ message: "Accelerez SVP" });
      expect(result.success).toBe(true);
      expect(result.data!.message).toBe("Accelerez SVP");
    });

    it("rejects message over 500 chars", () => {
      const result = reminderBodySchema.safeParse({ message: "x".repeat(501) });
      expect(result.success).toBe(false);
    });
  });
});

// Test the service error class
describe("GroupNotFoundError", () => {
  it("has correct name and message", async () => {
    const { GroupNotFoundError } = await import("../reminder-service");
    const err = new GroupNotFoundError("abc-123");
    expect(err.name).toBe("GroupNotFoundError");
    expect(err.message).toBe("Group abc-123 not found");
  });
});
