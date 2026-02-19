import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, ApiError } from "@/services/api-client";
import { getCachedCourse, setCachedCourse } from "@/services/course-cache";
import { useCourseStore } from "@/stores/course-store";
import type { CourseData } from "@golfix/shared";

interface UseCourseDataResult {
  courseData: CourseData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCourseData(slug: string | null): UseCourseDataResult {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = courseData !== null;
  }, [courseData]);

  const revalidate = useCallback(
    async (cachedVersion: number, isStale: () => boolean) => {
      if (!slug) return;
      try {
        const fresh = await apiClient.get<CourseData>(`/courses/${slug}/data`);
        if (isStale()) return;
        if (fresh.dataVersion !== cachedVersion) {
          setCourseData(fresh);
          useCourseStore.getState().setCourse(fresh);
          await setCachedCourse(fresh);
        }
      } catch (err) {
        console.warn(`[useCourseData] Revalidation failed for "${slug}":`, err);
      }
    },
    [slug],
  );

  const fetchCourse = useCallback(
    async (useCache: boolean, isStale: () => boolean) => {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        if (useCache) {
          const cached = await getCachedCourse(slug);
          if (isStale()) return;
          if (cached) {
            setCourseData(cached);
            useCourseStore.getState().setCourse(cached);
            setLoading(false);
            revalidate(cached.dataVersion, isStale);
            return;
          }
        }

        const fresh = await apiClient.get<CourseData>(`/courses/${slug}/data`);
        if (isStale()) return;
        setCourseData(fresh);
        useCourseStore.getState().setCourse(fresh);
        await setCachedCourse(fresh);
      } catch (err) {
        if (isStale()) return;
        console.warn(`[useCourseData] Failed to load course "${slug}":`, err);
        if (!hasDataRef.current) {
          if (err instanceof ApiError && err.status === 401) {
            setError("Session expirée — veuillez vous reconnecter");
          } else if (err instanceof ApiError && err.status === 404) {
            setError("Parcours introuvable");
          } else {
            setError("Impossible de charger le parcours");
          }
        }
      } finally {
        if (!isStale()) {
          setLoading(false);
        }
      }
    },
    [slug, revalidate],
  );

  useEffect(() => {
    let stale = false;
    fetchCourse(true, () => stale);
    return () => {
      stale = true;
    };
  }, [fetchCourse]);

  const refetch = useCallback(() => {
    fetchCourse(false, () => false);
  }, [fetchCourse]);

  return { courseData, loading, error, refetch };
}
