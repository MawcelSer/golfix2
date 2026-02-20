import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiError } from "@/services/api-client";

export interface ManagedCourse {
  id: string;
  name: string;
  slug: string;
  holesCount: number;
  par: number;
  role: string;
}

export function CourseListScreen() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let stale = false;

    async function load() {
      try {
        const data = await apiClient.get<ManagedCourse[]>("/courses/managed");
        if (stale) return;
        setCourses(data);
      } catch (err) {
        if (stale) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Erreur de chargement");
        }
      } finally {
        if (!stale) setLoading(false);
      }
    }

    void load();
    return () => {
      stale = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/60">Chargement des parcours...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="mb-6 font-display text-2xl text-cream">Mes parcours</h2>
      {courses.length === 0 ? (
        <p className="text-cream/60">Aucun parcours associe a votre compte.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => navigate(`/course/${course.id}`)}
              className="rounded-xl border border-cream/10 bg-cream/5 p-5 text-left transition-colors hover:bg-cream/10"
            >
              <h3 className="mb-1 font-display text-lg text-cream">{course.name}</h3>
              <p className="text-sm text-cream/60">
                {course.holesCount} trous &middot; Par {course.par}
              </p>
              <span className="mt-2 inline-block rounded-full bg-cream/10 px-2 py-0.5 text-xs text-cream/70">
                {course.role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
