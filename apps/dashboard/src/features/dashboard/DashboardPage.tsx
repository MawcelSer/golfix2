import { useParams } from "react-router-dom";

export function DashboardPage() {
  const { courseId } = useParams<{ courseId: string }>();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-cream/60">
        Dashboard en direct pour le parcours <code className="text-gold">{courseId}</code>
      </p>
    </div>
  );
}
