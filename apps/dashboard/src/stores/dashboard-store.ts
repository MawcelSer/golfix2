import { create } from "zustand";
import type {
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
} from "@golfix/shared";

interface DashboardState {
  groups: DashboardGroupUpdate[];
  alerts: DashboardAlertEvent[];
  bottlenecks: DashboardBottleneckEvent[];
  connected: boolean;
}

interface DashboardActions {
  setGroups: (groups: DashboardGroupUpdate[]) => void;
  addAlert: (alert: DashboardAlertEvent) => void;
  setBottlenecks: (bottlenecks: DashboardBottleneckEvent[]) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialState: DashboardState = {
  groups: [],
  alerts: [],
  bottlenecks: [],
  connected: false,
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

  reset: () => set(initialState),
}));
