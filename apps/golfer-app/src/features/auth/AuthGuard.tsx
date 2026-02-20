import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore.persist?.hasHydrated?.() ?? true;

  if (!hasHydrated) {
    return null;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
