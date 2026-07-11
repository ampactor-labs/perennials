import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/settings";
import { useDataState } from "@/data/store";
import { IconBook, IconGuide, IconMoon, IconSun } from "./icons";

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--green)" />
      <path d="M32 52c0-11 0-16-6-22-4-4-10-5-13-5 0 8 2 15 7 19 4 3 8 4 12 4z" fill="#8bbf6a" />
      <path d="M32 52c0-13 0-19 7-25 4-4 11-5 14-5 0 9-2 16-7 21-4 4-9 6-14 6z" fill="#c8e6a8" />
      <path d="M32 54V30" stroke="#2f4f2f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="22" r="6" fill="#f2c14e" />
    </svg>
  );
}

function ThemeToggle() {
  const [pref, setPref] = useTheme();
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      className="icon-btn"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <IconSun width={20} height={20} /> : <IconMoon width={20} height={20} />}
    </button>
  );
}

function DataGate({ children }: { children: ReactNode }) {
  const state = useDataState();
  if (state.status === "loading") {
    return (
      <div className="loading">
        <span className="spinner" />
        <p>Loading the plant database…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="empty">
        <h3>Couldn't load the plant data</h3>
        <p>{state.error}. Check your connection and reload.</p>
      </div>
    );
  }
  return <>{children}</>;
}

const TABS = [
  { to: "/", label: "Guide", icon: IconGuide, end: true },
  { to: "/about", label: "Field notes", icon: IconBook, end: false },
];

export function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          <BrandMark />
          <span className="brand-name">
            Perr<b>·</b>enials
          </span>
        </NavLink>
        <ThemeToggle />
      </header>

      <main>
        <DataGate>
          <Outlet />
        </DataGate>
      </main>

      <nav className="app-nav" aria-label="Sections">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon />
            <span>{label}</span>
            <span className="nav-dot" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
