import { create } from "zustand";
import type {
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
} from "@golfix/shared";

export interface CourseHole {
  holeNumber: number;
  par: number;
  greenCenter: { x: number; y: number } | null;
  teePosition: { x: number; y: number } | null;
}

export interface ActiveCourse {
  id: string;
  name: string;
  slug: string;
  holesCount: number;
  par: number;
  holes: CourseHole[];
}

interface DashboardState {
  groups: DashboardGroupUpdate[];
  alerts: DashboardAlertEvent[];
  bottlenecks: DashboardBottleneckEvent[];
  connected: boolean;
  activeCourse: ActiveCourse | null;
  courseLoading: boolean;
}

interface DashboardActions {
  setGroups: (groups: DashboardGroupUpdate[]) => void;
  addAlert: (alert: DashboardAlertEvent) => void;
  setBottlenecks: (bottlenecks: DashboardBottleneckEvent[]) => void;
  setConnected: (connected: boolean) => void;
  setActiveCourse: (course: ActiveCourse | null) => void;
  setCourseLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState: DashboardState = {
  groups: [],
  alerts: [],
  bottlenecks: [],
  connected: false,
  activeCourse: null,
  courseLoading: false,
};

export const useDashboardStore = create<DashboardState & DashboardActions>()((set) => ({
  ...initialState,

  setGroups: (groups) => set({ groups }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
    })),

  setBottlenecks: (bottlenecks) => set({ bottlenecks }),

  setConnected: (connected) => set({ connected }),

  setActiveCourse: (course) => set({ activeCourse: course }),

  setCourseLoading: (loading) => set({ courseLoading: loading }),

  reset: () => set(initialState),
}));
