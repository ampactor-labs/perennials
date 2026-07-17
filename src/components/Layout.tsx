import type { ComponentType, ReactNode, SVGProps } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/lib/settings";
import { useDataState } from "@/data/store";
import { useKept } from "@/lib/kept";
import { IconAlert, IconBook, IconGarden, IconGuide, IconKeep, IconMoon, IconSun } from "./icons";

/* A herbarium sheet in miniature: a paper tile, a sprig pressed to sepia (the
   colour specimens actually dry to, and the ink of her notes), and the one dot
   of colour a pressed plant keeps, its bloom, in the green the wordmark's
   interpunct already wears. Every colour is a token, so the mark presses
   itself into whichever paper the theme is printed on. */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="13"
        fill="var(--paper-sunk)"
        stroke="var(--line-strong)"
        strokeWidth="2"
      />
      <path
        d="M34 56 C34 47 32 38 30 30 C29 25 28.5 21 28 17"
        fill="none"
        stroke="var(--sepia)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M33.5 46 C27 47.5 19.5 44 16.5 36.5 C23 33.5 30.5 37.5 33.5 46 Z" fill="var(--sepia)" />
      <path d="M31 33 C31.5 25.5 36.5 19.5 45 18.5 C45.5 26.5 39.5 32 31 33 Z" fill="var(--sepia)" />
      <circle cx="27.5" cy="13.5" r="5" fill="var(--green)" />
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
      <div className="loading" role="status">
        <span className="spinner" />
        <span className="sr-only">Opening the guide…</span>
      </div>
    );
  }
  if (state.status === "error") {
    // The old copy printed the raw error ("Failed to fetch") and told her to
    // reload, inside an installed PWA, which has no address bar and no reload
    // button. And it said the same thing whether she was offline or the server
    // was down, because nothing ever asked which.
    const offline = !navigator.onLine;
    return (
      <div className="empty">
        <h2>{offline ? "No signal, and the guide isn't saved yet" : "The guide didn't load"}</h2>
        <p>
          {offline
            ? "This phone hasn't finished downloading the guide. Open it once somewhere with signal and it will work in the garden from then on."
            : "Nothing is wrong with your phone. The server didn't answer. Try again in a moment."}
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
// upstream is stuck, and nobody would otherwise find out, because the app keeps
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
          This guide was last updated <b>{days} days ago</b>. It refreshes itself every week, so
          something upstream is stuck. What you're looking at is still real, just old.
        </span>
      </div>
    </div>
  );
}

type Tab = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end: boolean;
  /** Only Kept carries a number: it is the one tab whose contents she put there. */
  badge?: boolean;
};

// The nav grid grows one implicit column per tab (grid-auto-flow: column), so
// adding this fourth one needs no CSS change. It used to be a fixed repeat(),
// and a stale two-column copy in browse.css wrapped the third tab into a hidden
// row on phones. IconGarden has been unused since the 43-plant garden view was
// cut; the yard sketch is that view's successor, so it takes the icon back.
const TABS: Tab[] = [
  { to: "/", label: "Guide", icon: IconGuide, end: true },
  { to: "/kept", label: "Kept", icon: IconKeep, end: false, badge: true },
  { to: "/yards", label: "Yards", icon: IconGarden, end: false },
  { to: "/about", label: "Field notes", icon: IconBook, end: false },
];

export function Layout() {
  const { kept } = useKept();
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
        {TABS.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <span className="nav-icon">
              <Icon />
              {badge && kept.length > 0 && <span className="nav-badge">{kept.length}</span>}
            </span>
            <span>{label}</span>
            <span className="nav-dot" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
