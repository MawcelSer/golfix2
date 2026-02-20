import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

const navItems = [
  { to: "/", label: "Parcours", end: true },
  { to: "/reports", label: "Rapports", end: false },
];

export function DashboardShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-dvh bg-pine font-sans text-cream">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-cream/10 bg-pine">
        <div className="border-b border-cream/10 px-4 py-4">
          <h1 className="font-display text-lg text-gold">Golfix</h1>
          <p className="text-xs text-cream/50">Dashboard</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-cream/10 text-cream"
                    : "text-cream/60 hover:bg-cream/5 hover:text-cream"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-cream/10 px-4 py-3">
          <p className="truncate text-sm text-cream/70">{user?.displayName}</p>
          <button onClick={logout} className="mt-1 text-xs text-cream/40 hover:text-cream/70">
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
