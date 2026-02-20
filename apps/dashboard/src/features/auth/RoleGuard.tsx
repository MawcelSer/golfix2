import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { apiClient, ApiError } from "@/services/api-client";

interface ManagedCourse {
  id: string;
  name: string;
  slug: string;
  holesCount: number;
  par: number;
  role: string;
}

export function RoleGuard() {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");

  useEffect(() => {
    let stale = false;

    async function checkRole() {
      try {
        const courses = await apiClient.get<ManagedCourse[]>("/courses/managed");
        if (stale) return;
        setStatus(courses.length > 0 ? "authorized" : "unauthorized");
      } catch (err) {
        if (stale) return;
        if (err instanceof ApiError && err.status === 401) {
          setStatus("unauthorized");
        } else {
          console.warn("[RoleGuard] Failed to check role:", err);
          setStatus("unauthorized");
        }
      }
    }

    void checkRole();
    return () => {
      stale = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-pine">
        <p className="text-cream/60">Chargement...</p>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
