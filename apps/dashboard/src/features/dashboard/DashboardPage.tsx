import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { DashboardGroupUpdate } from "@golfix/shared";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useDashboardSocket } from "@/hooks/use-dashboard-socket";
import { apiClient, ApiError } from "@/services/api-client";
import { CourseMap } from "@/features/map/CourseMap";
import { GroupListPanel } from "@/features/groups/GroupListPanel";
import { AlertFeedPanel } from "@/features/alerts/AlertFeedPanel";
import { SendReminderDialog } from "@/features/groups/SendReminderDialog";
import { ToastContainer } from "@/components/Toast";
import type { ActiveCourse } from "@/stores/dashboard-store";

export function DashboardPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const groups = useDashboardStore((s) => s.groups);
  const alerts = useDashboardStore((s) => s.alerts);
  const connected = useDashboardStore((s) => s.connected);
  const activeCourse = useDashboardStore((s) => s.activeCourse);
  const courseLoading = useDashboardStore((s) => s.courseLoading);
  const setActiveCourse = useDashboardStore((s) => s.setActiveCourse);
  const setCourseLoading = useDashboardStore((s) => s.setCourseLoading);

  const [reminderTarget, setReminderTarget] = useState<DashboardGroupUpdate | null>(null);

  // Connect WebSocket for live updates
  useDashboardSocket(courseId);

  // Fetch course data on mount
  useEffect(() => {
    if (!courseId) return;

    let stale = false;
    setCourseLoading(true);

    async function loadCourse() {
      try {
        const data = await apiClient.get<ActiveCourse>(`/courses/by-id/${courseId}/data`);
        if (stale) return;
        setActiveCourse(data);
      } catch (err) {
        if (stale) return;
        if (err instanceof ApiError) {
          console.warn("[DashboardPage] Failed to load course:", err.message);
        }
      } finally {
        if (!stale) setCourseLoading(false);
      }
    }

    void loadCourse();
    return () => {
      stale = true;
    };
  }, [courseId, setActiveCourse, setCourseLoading]);

  if (courseLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/60">Chargement du parcours...</p>
      </div>
    );
  }

  if (!activeCourse) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/40">Parcours introuvable</p>
      </div>
    );
  }

  // Compute map center from first hole with a green center
  const firstHole = activeCourse.holes.find((h) => h.greenCenter !== null);
  const centerLat = firstHole?.greenCenter?.y ?? 48.85;
  const centerLng = firstHole?.greenCenter?.x ?? 2.35;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-cream">{activeCourse.name}</h1>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-xs text-cream/50">{connected ? "Connecte" : "Deconnecte"}</span>
        </div>
      </div>

      {/* Main layout: map left, panels right */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Map (60%) */}
        <div className="flex-[3] overflow-hidden rounded-lg" data-testid="map-container">
          <CourseMap
            groups={groups}
            holes={activeCourse.holes}
            centerLat={centerLat}
            centerLng={centerLng}
          />
        </div>

        {/* Side panels (40%) */}
        <div className="flex flex-[2] flex-col gap-4 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <GroupListPanel groups={groups} onReminder={setReminderTarget} />
          </div>
          <div className="flex-1 overflow-auto">
            <AlertFeedPanel alerts={alerts} />
          </div>
        </div>
      </div>

      {/* Reminder dialog */}
      {reminderTarget && courseId && (
        <SendReminderDialog
          courseId={courseId}
          groupId={reminderTarget.groupId}
          groupNumber={reminderTarget.groupNumber}
          onClose={() => setReminderTarget(null)}
        />
      )}

      <ToastContainer />
    </div>
  );
}
