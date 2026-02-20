import { get, set, del } from "idb-keyval";
import type { CourseData } from "@golfix/shared";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedCourse {
  data: CourseData;
  cachedAt: number;
}

function cacheKey(slug: string): string {
  return `course:${slug}`;
}

export async function getCachedCourse(slug: string): Promise<CourseData | null> {
  try {
    const entry = await get<CachedCourse>(cacheKey(slug));
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > CACHE_TTL_MS) {
      await del(cacheKey(slug)).catch((err) =>
        console.warn("[course-cache] Failed to delete expired entry:", err),
      );
      return null;
    }

    return entry.data;
  } catch (err) {
    console.warn(`[course-cache] Failed to read cache for "${slug}":`, err);
    return null;
  }
}

export async function setCachedCourse(course: CourseData): Promise<void> {
  try {
    const entry: CachedCourse = {
      data: course,
      cachedAt: Date.now(),
    };
    await set(cacheKey(course.slug), entry);
  } catch (err) {
    console.warn(`[course-cache] Failed to write cache for "${course.slug}":`, err);
  }
}

export async function clearCachedCourse(slug: string): Promise<void> {
  try {
    await del(cacheKey(slug));
  } catch (err) {
    console.warn(`[course-cache] Failed to clear cache for "${slug}":`, err);
  }
}
