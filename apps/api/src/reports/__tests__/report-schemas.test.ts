import { describe, expect, it } from "vitest";
import { dailyReportParamsSchema } from "../report-schemas";

describe("dailyReportParamsSchema", () => {
  it("accepts valid courseId and date", () => {
    const result = dailyReportParamsSchema.safeParse({
      courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      date: "2026-02-20",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = dailyReportParamsSchema.safeParse({
      courseId: "not-a-uuid",
      date: "2026-02-20",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = dailyReportParamsSchema.safeParse({
      courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      date: "20-02-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const result = dailyReportParamsSchema.safeParse({
      courseId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(false);
  });
});
