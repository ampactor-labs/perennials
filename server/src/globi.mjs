// Flower-visitor records from GloBI (globalbioticinteractions.org), grouped into
// the coarse categories a gardener actually searches by: bees, butterflies,
// hoverflies, moths, beetles, wasps, flies, hummingbirds.
//
// GloBI's aggregate data is CC BY 4.0. Two things bite here:
//  - It rejects the default Node/Python user agent. Without a real User-Agent
//    every request fails, which reads as "this plant has no visitors" rather
//    than as an error. Always send one.
//  - Records are filed under several interaction types depending on the source
//    dataset, so a plant with visitors can still return nothing for any single
//    type. Query all three.
const UA = "perennials-enrichment/1.0 (+https://ampactor.dev/perennials)";
const TYPES = ["flowersVisitedBy", "pollinatedBy", "visitedBy"];

// Group on the visitor's FAMILY, taken from GloBI's taxon path. Family is stable
// and available; genus-name matching would miss most of the long tail.
const GROUP_BY_FAMILY = new Map(
  Object.entries({
    Apidae: "Bees", Megachilidae: "Bees", Andrenidae: "Bees", Halictidae: "Bees",
    Colletidae: "Bees", Melittidae: "Bees",

    Nymphalidae: "Butterflies", Pieridae: "Butterflies", Lycaenidae: "Butterflies",
    Papilionidae: "Butterflies", Hesperiidae: "Butterflies", Riodinidae: "Butterflies",

    Sphingidae: "Moths", Noctuidae: "Moths", Erebidae: "Moths", Geometridae: "Moths",
    Crambidae: "Moths", Pyralidae: "Moths", Arctiidae: "Moths", Sesiidae: "Moths",
    Saturniidae: "Moths", Zygaenidae: "Moths", Tortricidae: "Moths", Pterophoridae: "Moths",

    // Hoverflies get their own group: they pollinate and their larvae eat aphids,
    // which is the beneficial-insect signal a permaculture gardener wants.
    Syrphidae: "Hoverflies",

    Muscidae: "Flies", Tachinidae: "Flies", Calliphoridae: "Flies", Bombyliidae: "Flies",
    Anthomyiidae: "Flies", Sarcophagidae: "Flies", Empididae: "Flies",
    Stratiomyidae: "Flies", Conopidae: "Flies",

    Cerambycidae: "Beetles", Chrysomelidae: "Beetles", Coccinellidae: "Beetles",
    Cantharidae: "Beetles", Mordellidae: "Beetles", Melyridae: "Beetles",
    Buprestidae: "Beetles", Scarabaeidae: "Beetles", Cleridae: "Beetles",
    Oedemeridae: "Beetles", Nitidulidae: "Beetles",

    Vespidae: "Wasps", Sphecidae: "Wasps", Crabronidae: "Wasps", Chrysididae: "Wasps",
    Ichneumonidae: "Wasps", Braconidae: "Wasps", Scoliidae: "Wasps", Tiphiidae: "Wasps",
    Pompilidae: "Wasps",

    Trochilidae: "Hummingbirds",
  }),
);

async function pathsFor(scientificName, type) {
  const url =
    "https://api.globalbioticinteractions.org/interaction?sourceTaxon=" +
    encodeURIComponent(scientificName) +
    `&interactionType=${type}&fields=target_taxon_path&type=json&limit=800`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GloBI HTTP ${res.status} (${scientificName}/${type})`);
  const body = await res.json();
  return body.data ?? [];
}

/**
 * The visitor groups GloBI knows for one plant, sorted. An empty array is a real
 * answer, not a failure: wind-pollinated plants (grasses, conifers) have none.
 * Throws if GloBI itself is unreachable, so a sweep can tell the two apart.
 */
export async function attractsFor(scientificName) {
  const groups = new Set();
  let anyOk = false;
  let lastErr = null;

  for (const type of TYPES) {
    try {
      const rows = await pathsFor(scientificName, type);
      anyOk = true;
      for (const row of rows) {
        const path = row?.[0];
        if (!path) continue;
        for (const part of String(path).split("|")) {
          const group = GROUP_BY_FAMILY.get(part.trim());
          if (group) groups.add(group);
        }
      }
    } catch (e) {
      lastErr = e;
    }
  }
  if (!anyOk) throw lastErr ?? new Error(`GloBI unreachable for ${scientificName}`);
  return [...groups].sort();
}
