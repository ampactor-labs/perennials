import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/settings";
import { useDataState } from "@/data/store";
import { IconAlert, IconBook, IconGuide, IconMoon, IconSun } from "./icons";

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
    // Only claim to be downloading when we actually are. This gate shows on every
    // launch — including offline ones, where it was telling her it was pulling a
    // megabyte over a network she did not have, and that this only happens once,
    // for the hundredth time.
    return (
      <div className="loading">
        <span className="spinner" />
        {state.cold ? (
          <p>
            Downloading the guide — about a megabyte.
            <br />
            It only happens once. After this it works with no signal.
          </p>
        ) : (
          <p>Opening the guide…</p>
        )}
      </div>
    );
  }
  if (state.status === "error") {
    // The old copy printed the raw error ("Failed to fetch") and told her to
    // reload — inside an installed PWA, which has no address bar and no reload
    // button. And it said the same thing whether she was offline or the server
    // was down, because nothing ever asked which.
    const offline = !navigator.onLine;
    return (
      <div className="empty">
        <h2>{offline ? "No signal, and no guide saved yet" : "The plant data didn't load"}</h2>
        <p>
          {offline
            ? "This phone hasn't finished downloading the guide. Open it once where there's signal and it will work in the garden from then on."
            : "Nothing is wrong with your phone — the server didn't answer. Try again in a moment."}
        </p>
        <button className="btn btn--primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

// The dataset re-pulls itself every 7 days. If it hasn't in twice that, something
// upstream is stuck — and nobody would otherwise find out, because the app keeps
// serving the last good data quietly, forever. So say so, and only then. Silence
// is the healthy state.
const STALE_AFTER_DAYS = 14;
const DAY_MS = 86_400_000;

function StaleNotice() {
  const state = useDataState();
  if (state.status !== "ready") return null;
  const { generatedAt } = state.data.meta;
  if (!generatedAt) return null;

  const days = Math.floor((Date.now() - new Date(generatedAt).getTime()) / DAY_MS);
  if (!Number.isFinite(days) || days < STALE_AFTER_DAYS) return null;

  return (
    <div className="wrap">
      <div className="callout callout--warn" style={{ marginTop: "var(--sp-3)" }}>
        <IconAlert />
        <span>
          This plant data was last updated <b>{days} days ago</b>. It normally refreshes itself
          every week, so something upstream is stuck. What you're seeing is still real, just old.
        </span>
      </div>
    </div>
  );
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
            Per<b>·</b>ennials
          </span>
        </NavLink>
        <ThemeToggle />
      </header>

      <main>
        <DataGate>
          <StaleNotice />
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
