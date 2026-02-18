import { create } from "zustand";
import type { CourseData } from "@golfix/shared";

interface CourseState {
  courseSlug: string | null;
  courseData: CourseData | null;
}

interface CourseActions {
  setCourse: (slug: string, data: CourseData) => void;
  clearCourse: () => void;
}

const initialState: CourseState = {
  courseSlug: null,
  courseData: null,
};

export const useCourseStore = create<CourseState & CourseActions>()((set) => ({
  ...initialState,

  setCourse: (slug, data) => set({ courseSlug: slug, courseData: data }),

  clearCourse: () => set(initialState),
}));
