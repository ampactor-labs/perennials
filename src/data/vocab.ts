// The controlled vocabulary every filter, facet and overlay draws from.
// Each dimension is a readonly tuple (so we can both type-check values and
// iterate them to build facet UIs) paired with display metadata.

export type Meta = {
  label: string;
  /** Short gloss shown in tooltips / legends. */
  hint?: string;
  /** Encoding color for swatches, legends and map overlays. */
  color?: string;
};

function meta<const T extends readonly string[]>(
  keys: T,
  m: Record<T[number], Meta>,
): { keys: T; meta: Record<T[number], Meta> } {
  return { keys, meta: m };
}

export const LIFE_CYCLE = meta(["perennial", "biennial", "annual"] as const, {
  perennial: { label: "Perennial", hint: "Lives many years — her main focus" },
  biennial: { label: "Biennial", hint: "Two-year cycle, often self-seeding" },
  annual: { label: "Annual", hint: "One season" },
});

// The forest-garden layers (Jacke's "layer cake").
export const LAYER = meta(
  ["canopy", "understory", "shrub", "herb", "groundcover", "vine", "root"] as const,
  {
    canopy: { label: "Canopy tree", hint: "Tall overstory, >25 ft" },
    understory: { label: "Understory tree", hint: "Small tree / large shrub" },
    shrub: { label: "Shrub" },
    herb: { label: "Herbaceous", hint: "Non-woody perennial" },
    groundcover: { label: "Groundcover", hint: "Low, spreading, soil-covering" },
    vine: { label: "Vine / climber" },
    root: { label: "Root / bulb", hint: "Rhizosphere — harvested below ground" },
  },
);

export const HABIT = meta(
  ["clumping", "running", "mat-forming", "climbing", "upright"] as const,
  {
    clumping: { label: "Clumping", hint: "Stays put, expands slowly" },
    running: { label: "Running", hint: "Spreads by runner / rhizome" },
    "mat-forming": { label: "Mat-forming", hint: "Dense low carpet" },
    climbing: { label: "Climbing" },
    upright: { label: "Upright" },
  },
);

export const SUN = meta(
  ["full-sun", "part-sun", "part-shade", "full-shade"] as const,
  {
    "full-sun": { label: "Full sun", hint: "6+ hrs direct", color: "#f2c14e" },
    "part-sun": { label: "Part sun", hint: "4–6 hrs", color: "#e0b25a" },
    "part-shade": { label: "Part shade", hint: "2–4 hrs", color: "#9bb08a" },
    "full-shade": { label: "Full shade", hint: "<2 hrs / dappled", color: "#5f7a63" },
  },
);

export const MOISTURE = meta(["dry", "moist", "wet"] as const, {
  dry: { label: "Dry", hint: "Drought-tolerant / sharp drainage", color: "#cdb891" },
  moist: { label: "Moist", hint: "Average, well-drained but not dry", color: "#7fae8a" },
  wet: { label: "Wet", hint: "Boggy / poorly drained", color: "#4f8fa6" },
});

export const WATER = meta(["low", "moderate", "high"] as const, {
  low: { label: "Low water", hint: "Little to no irrigation once established" },
  moderate: { label: "Moderate water" },
  high: { label: "High water", hint: "Wants steady moisture" },
});

export const COLOR = meta(
  [
    "yellow",
    "blue",
    "purple",
    "red",
    "pink",
    "orange",
    "white",
    "green",
    "cream",
  ] as const,
  {
    yellow: { label: "Yellow", color: "#f2c14e" },
    blue: { label: "Blue", color: "#4a72b0" },
    purple: { label: "Purple", color: "#8a5fa8" },
    red: { label: "Red", color: "#c0433f" },
    pink: { label: "Pink", color: "#d98aa8" },
    orange: { label: "Orange", color: "#e0863c" },
    white: { label: "White", color: "#fbfaf5" },
    green: { label: "Green", color: "#7fae5a" },
    cream: { label: "Cream", color: "#ecdfb8" },
  },
);

export const SEASON = meta(
  [
    "early-spring",
    "spring",
    "late-spring",
    "summer",
    "late-summer",
    "fall",
  ] as const,
  {
    "early-spring": { label: "Early spring" },
    spring: { label: "Spring" },
    "late-spring": { label: "Late spring" },
    summer: { label: "Summer" },
    "late-summer": { label: "Late summer" },
    fall: { label: "Fall" },
  },
);

// Minerals a dynamic accumulator concentrates (Jacke, p535).
export const MINERAL = meta(
  ["N", "P", "K", "Ca", "Mg", "S", "Fe", "Mn", "Cu", "Co", "Na", "Si"] as const,
  {
    N: { label: "Nitrogen" },
    P: { label: "Phosphorus" },
    K: { label: "Potassium" },
    Ca: { label: "Calcium" },
    Mg: { label: "Magnesium" },
    S: { label: "Sulfur" },
    Fe: { label: "Iron" },
    Mn: { label: "Manganese" },
    Cu: { label: "Copper" },
    Co: { label: "Cobalt" },
    Na: { label: "Sodium" },
    Si: { label: "Silicon" },
  },
);

export const EDIBLE_PART = meta(
  ["fruit", "nut", "seed", "leaf", "shoot", "stem", "flower", "root", "tuber"] as const,
  {
    fruit: { label: "Fruit" },
    nut: { label: "Nut" },
    seed: { label: "Seed" },
    leaf: { label: "Leaf" },
    shoot: { label: "Shoot" },
    stem: { label: "Stem" },
    flower: { label: "Flower" },
    root: { label: "Root" },
    tuber: { label: "Tuber" },
  },
);

export const WILDLIFE = meta(
  ["bees", "butterflies", "hummingbirds", "birds", "beneficial-insects"] as const,
  {
    bees: { label: "Bees", color: "#f2c14e" },
    butterflies: { label: "Butterflies", color: "#e0863c" },
    hummingbirds: { label: "Hummingbirds", color: "#c0433f" },
    birds: { label: "Birds", hint: "Seeds / berries / cover", color: "#4a72b0" },
    "beneficial-insects": {
      label: "Beneficial insects",
      hint: "Nectary for predators & parasitoids",
      color: "#8bbf6a",
    },
  },
);

export const GROWTH_RATE = meta(["slow", "moderate", "fast"] as const, {
  slow: { label: "Slow" },
  moderate: { label: "Moderate" },
  fast: { label: "Fast" },
});

export const EASE = meta(["easy", "moderate", "finicky"] as const, {
  easy: { label: "Easy", hint: "Forgiving, low-maintenance" },
  moderate: { label: "Moderate" },
  finicky: { label: "Finicky", hint: "Particular about conditions" },
});

// What a plant tends to indicate about a site when found growing wild (Jacke, p207).
export const SITE_CONDITION = meta(
  [
    "dry-soil",
    "wet-soil",
    "compacted",
    "disturbed",
    "acidic",
    "alkaline",
    "sandy",
    "clay",
    "low-fertility",
    "high-fertility",
    "low-nitrogen",
    "high-nitrogen",
  ] as const,
  {
    "dry-soil": { label: "Dry soil" },
    "wet-soil": { label: "Wet soil" },
    compacted: { label: "Compaction / hardpan" },
    disturbed: { label: "Disturbed / recently tilled" },
    acidic: { label: "Acidic soil" },
    alkaline: { label: "Alkaline soil" },
    sandy: { label: "Sandy soil" },
    clay: { label: "Clay soil" },
    "low-fertility": { label: "Low fertility" },
    "high-fertility": { label: "High fertility" },
    "low-nitrogen": { label: "Low nitrogen" },
    "high-nitrogen": { label: "High nitrogen" },
  },
);

export type LifeCycle = (typeof LIFE_CYCLE.keys)[number];
export type Layer = (typeof LAYER.keys)[number];
export type Habit = (typeof HABIT.keys)[number];
export type Sun = (typeof SUN.keys)[number];
export type Moisture = (typeof MOISTURE.keys)[number];
export type Water = (typeof WATER.keys)[number];
export type Color = (typeof COLOR.keys)[number];
export type Season = (typeof SEASON.keys)[number];
export type Mineral = (typeof MINERAL.keys)[number];
export type EdiblePart = (typeof EDIBLE_PART.keys)[number];
export type Wildlife = (typeof WILDLIFE.keys)[number];
export type GrowthRate = (typeof GROWTH_RATE.keys)[number];
export type Ease = (typeof EASE.keys)[number];
export type SiteCondition = (typeof SITE_CONDITION.keys)[number];

/** USDA hardiness zones we let people choose between. */
export const ZONES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Zone = (typeof ZONES)[number];
