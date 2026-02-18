import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/services/api-client";
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

  const fetchCourse = useCallback(
    async (useCache: boolean) => {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        // Try cache first
        if (useCache) {
          const cached = await getCachedCourse(slug);
          if (cached) {
            setCourseData(cached);
            useCourseStore.getState().setCourse(slug, cached);
            setLoading(false);

            // Background revalidate
            revalidate(cached.dataVersion);
            return;
          }
        }

        // Fetch from API
        const fresh = await apiClient.get<CourseData>(`/courses/${slug}/data`);
        setCourseData(fresh);
        useCourseStore.getState().setCourse(slug, fresh);
        await setCachedCourse(fresh);
      } catch {
        // If we already have data, keep showing it (offline fallback)
        if (!courseData) {
          setError("Impossible de charger le parcours");
        }
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug],
  );

  async function revalidate(cachedVersion: number) {
    if (!slug) return;
    try {
      const fresh = await apiClient.get<CourseData>(`/courses/${slug}/data`);
      if (fresh.dataVersion !== cachedVersion) {
        setCourseData(fresh);
        useCourseStore.getState().setCourse(slug, fresh);
        await setCachedCourse(fresh);
      }
    } catch {
      // Network error during revalidation — keep cached data
    }
  }

  useEffect(() => {
    fetchCourse(true);
  }, [fetchCourse]);

  const refetch = useCallback(() => {
    fetchCourse(false);
  }, [fetchCourse]);

  return { courseData, loading, error, refetch };
}
