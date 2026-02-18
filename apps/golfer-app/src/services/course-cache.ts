import { get, set, del } from "idb-keyval";
import type { CourseData } from "@golfix/shared";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedCourse {
  data: CourseData;
  dataVersion: number;
  cachedAt: number;
}

function cacheKey(slug: string): string {
  return `course:${slug}`;
}

export async function getCachedCourse(slug: string): Promise<CourseData | null> {
  const entry = await get<CachedCourse>(cacheKey(slug));
  if (!entry) return null;

  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) {
    await del(cacheKey(slug));
    return null;
  }

  return entry.data;
}

export async function setCachedCourse(course: CourseData): Promise<void> {
  const entry: CachedCourse = {
    data: course,
    dataVersion: course.dataVersion,
    cachedAt: Date.now(),
  };
  await set(cacheKey(course.slug), entry);
}

export async function clearCachedCourse(slug: string): Promise<void> {
  await del(cacheKey(slug));
}

export async function isCacheValid(slug: string, currentVersion: number): Promise<boolean> {
  const entry = await get<CachedCourse>(cacheKey(slug));
  if (!entry) return false;

  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) return false;

  return entry.dataVersion === currentVersion;
}
