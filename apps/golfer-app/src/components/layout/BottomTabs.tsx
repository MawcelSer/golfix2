import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/gps", label: "GPS" },
  { to: "/scorecard", label: "Carte" },
  { to: "/profile", label: "Profil" },
] as const;

export function BottomTabs() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex h-14 items-center justify-around bg-pine text-cream">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center text-xs font-medium ${isActive ? "text-gold" : "text-cream/70"}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
