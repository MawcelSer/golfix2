import { createBrowserRouter } from "react-router-dom";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { RoleGuard } from "@/features/auth/RoleGuard";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { UnauthorizedScreen } from "@/features/auth/UnauthorizedScreen";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { CourseListScreen } from "@/features/courses/CourseListScreen";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { DailyReportScreen } from "@/features/reports/DailyReportScreen";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/unauthorized", element: <UnauthorizedScreen /> },

  {
    element: <AuthGuard />,
    children: [
      {
        element: <RoleGuard />,
        children: [
          {
            element: <DashboardShell />,
            children: [
              { path: "/", element: <CourseListScreen /> },
              { path: "/course/:courseId", element: <DashboardPage /> },
              { path: "/reports/:courseId", element: <DailyReportScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
