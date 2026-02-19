import { create } from "zustand";
import type { CourseData } from "@golfix/shared";

interface CourseState {
  courseSlug: string | null;
  courseData: CourseData | null;
}

interface CourseActions {
  setCourse: (data: CourseData) => void;
  clearCourse: () => void;
}

const initialState: CourseState = {
  courseSlug: null,
  courseData: null,
};

export const useCourseStore = create<CourseState & CourseActions>()((set) => ({
  ...initialState,

  setCourse: (data) => set({ courseSlug: data.slug, courseData: data }),

  clearCourse: () => set(initialState),
}));
