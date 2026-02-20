import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser, AuthTokens, AuthResponse } from "@golfix/shared";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  gdprConsent: boolean;
  gdprConsentAt: number | null;
}

interface AuthActions {
  setAuth: (response: AuthResponse) => void;
  updateTokens: (tokens: AuthTokens) => void;
  acceptGdpr: () => void;
  revokeGdpr: () => void;
  logout: () => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  gdprConsent: false,
  gdprConsentAt: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setAuth: (response) =>
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),

      updateTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),

      acceptGdpr: () =>
        set({
          gdprConsent: true,
          gdprConsentAt: Date.now(),
        }),

      revokeGdpr: () =>
        set({
          gdprConsent: false,
          gdprConsentAt: null,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        }),

      reset: () => set(initialState),
    }),
    {
      name: "golfix-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        gdprConsent: state.gdprConsent,
        gdprConsentAt: state.gdprConsentAt,
      }),
    },
  ),
);
