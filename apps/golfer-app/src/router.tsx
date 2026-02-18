import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { RegisterScreen } from "@/features/auth/RegisterScreen";
import { AnonymousScreen } from "@/features/auth/AnonymousScreen";
import { LandingPage } from "@/features/session/LandingPage";
import { GpsScreen } from "@/features/gps/GpsScreen";

function ScorecardPlaceholder() {
  return <div>Scorecard Screen</div>;
}

function ProfilePlaceholder() {
  return <div>Profile Screen</div>;
}

export const router = createBrowserRouter([
  // ── Auth routes (no guard) ────────────────────────────────────────
  { path: "/login", element: <LoginScreen /> },
  { path: "/register", element: <RegisterScreen /> },
  { path: "/anonymous", element: <AnonymousScreen /> },

  // ── Protected routes ──────────────────────────────────────────────
  {
    element: <AuthGuard />,
    children: [
      {
        path: "/",
        element: (
          <AppShell>
            <LandingPage />
          </AppShell>
        ),
      },
      {
        path: "/gps",
        element: (
          <AppShell>
            <GpsScreen />
          </AppShell>
        ),
      },
      {
        path: "/scorecard",
        element: (
          <AppShell>
            <ScorecardPlaceholder />
          </AppShell>
        ),
      },
      {
        path: "/profile",
        element: (
          <AppShell>
            <ProfilePlaceholder />
          </AppShell>
        ),
      },
    ],
  },
]);
