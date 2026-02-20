import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: "success" | "error") => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = String(++nextId);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));

    // Auto-dismiss after 4s
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
