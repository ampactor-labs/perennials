// Merge several sources into one record, keeping a per-field note of where each
// value came from. Adapters are passed in priority order; the first source to
// supply a field wins, and that decision is recorded in `provenance`.
export function reconcile(results) {
  const fields = {};
  const provenance = {};
  for (const r of results) {
    if (!r?.fields) continue;
    for (const [name, fv] of Object.entries(r.fields)) {
      if (fields[name] !== undefined) continue;
      fields[name] = fv.value;
      provenance[name] = {
        source: fv.source,
        confidence: fv.confidence,
        ...(fv.note ? { note: fv.note } : {}),
      };
    }
  }
  return { fields, provenance };
}
