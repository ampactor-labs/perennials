import type { SVGProps } from "react";

// Every icon here is decorative: each one sits beside, or inside, a control that
// already carries its own text or aria-label. Left exposed, a screen reader reads
// out a stream of unnamed graphics.
const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const IconGuide = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 20c-2-4-4-5-7-5V6c3 0 5 1 7 4 2-3 4-4 7-4v9c-3 0-5 1-7 5Z" />
    <path d="M12 10v10" />
  </svg>
);

export const IconGarden = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M3.5 9h17M9 9v11.5M15 20.5V9" />
  </svg>
);

export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 4.5h9a3 3 0 0 1 3 3V21a3 3 0 0 0-3-3H5z" />
    <path d="M19 6.5V21a3 3 0 0 0-3-3" />
  </svg>
);

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m14 6-6 6 6 6" />
  </svg>
);

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17.5v.5" />
  </svg>
);

export const IconLeaf = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 20c0-9 6-15 16-15 0 10-6 15-14 15" />
    <path d="M4 20c3-6 7-9 12-10" />
  </svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* A pressed specimen's tab. `filled` is the kept state, the only icon here that
   has one, because it is the only one that reports something she decided. */
export const IconKeep = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z" />
  </svg>
);

/* Five petals. Like IconKeep, `filled` reports something she did (today's
   "Blooming today" tap), never a fact about the plant. Thinner stroke than the
   set: five petals at 1.7 smudge into a blot at button size. */
export const IconBloom = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base} {...p} strokeWidth={1.4} fill={filled ? "currentColor" : "none"}>
    <circle cx="12" cy="12" r="2.3" />
    {[0, 72, 144, 216, 288].map((r) => (
      <path
        key={r}
        transform={`rotate(${r} 12 12)`}
        d="M12 9.6C10.4 8.8 9.8 6.8 10.6 5.2 11 4.4 13 4.4 13.4 5.2 14.2 6.8 13.6 8.8 12 9.6Z"
      />
    ))}
  </svg>
);
