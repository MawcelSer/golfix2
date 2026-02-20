import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function UnauthorizedScreen() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-pine px-6 text-center">
      <h1 className="mb-4 font-display text-2xl text-cream">Acces refuse</h1>
      <p className="mb-6 max-w-sm text-cream/60">
        Votre compte n&apos;a pas de role de gestion associe a un parcours. Contactez
        l&apos;administrateur du parcours.
      </p>
      <button
        onClick={handleLogout}
        className="rounded-xl bg-cream/10 px-6 py-3 text-sm text-cream hover:bg-cream/15"
      >
        Se deconnecter
      </button>
    </div>
  );
}
