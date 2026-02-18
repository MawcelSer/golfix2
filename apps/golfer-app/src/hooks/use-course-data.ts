import { useCallback, useEffect, useRef, useState } from "react";
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
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = courseData !== null;
  }, [courseData]);

  const revalidate = useCallback(
    async (cachedVersion: number) => {
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
    },
    [slug],
  );

  const fetchCourse = useCallback(
    async (useCache: boolean) => {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        if (useCache) {
          const cached = await getCachedCourse(slug);
          if (cached) {
            setCourseData(cached);
            useCourseStore.getState().setCourse(slug, cached);
            setLoading(false);
            revalidate(cached.dataVersion);
            return;
          }
        }

        const fresh = await apiClient.get<CourseData>(`/courses/${slug}/data`);
        setCourseData(fresh);
        useCourseStore.getState().setCourse(slug, fresh);
        await setCachedCourse(fresh);
      } catch {
        if (!hasDataRef.current) {
          setError("Impossible de charger le parcours");
        }
      } finally {
        setLoading(false);
      }
    },
    [slug, revalidate],
  );

  useEffect(() => {
    fetchCourse(true);
  }, [fetchCourse]);

  const refetch = useCallback(() => {
    fetchCourse(false);
  }, [fetchCourse]);

  return { courseData, loading, error, refetch };
}
