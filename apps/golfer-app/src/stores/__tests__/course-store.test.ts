import { describe, it, expect, beforeEach } from "vitest";
import { useCourseStore } from "../course-store";
import type { CourseData } from "@golfix/shared";

function makeCourse(): CourseData {
  return {
    id: "c1",
    name: "Test Course",
    slug: "test-course",
    holesCount: 18,
    par: 72,
    paceTargetMinutes: 240,
    teeIntervalMinutes: 8,
    timezone: "Europe/Paris",
    dataVersion: 1,
    holes: [],
  };
}

describe("course-store", () => {
  beforeEach(() => {
    useCourseStore.getState().clearCourse();
  });

  it("sets course data", () => {
    const course = makeCourse();
    useCourseStore.getState().setCourse(course);

    const state = useCourseStore.getState();
    expect(state.courseSlug).toBe("test-course");
    expect(state.courseData).toEqual(course);
  });

  it("clears course data", () => {
    useCourseStore.getState().setCourse(makeCourse());
    useCourseStore.getState().clearCourse();

    const state = useCourseStore.getState();
    expect(state.courseSlug).toBeNull();
    expect(state.courseData).toBeNull();
  });

  it("resets to initial state on clear", () => {
    useCourseStore.getState().setCourse(makeCourse());
    useCourseStore.getState().clearCourse();

    expect(useCourseStore.getState()).toMatchObject({
      courseSlug: null,
      courseData: null,
    });
  });
});
