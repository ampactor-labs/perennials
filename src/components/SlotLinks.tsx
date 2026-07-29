import { Fragment } from "react";
import { Link } from "react-router-dom";
import { periodsFor, type BloomSlot } from "@/lib/bloom";
import { encodeConstraints } from "@/lib/constraints";

/** The browse URL that asks "who blooms in this slot": every recorded period
 *  covering it, applied as one facet step so they OR (lib/bloom.periodsFor).
 *  Asking on the slot's own name alone would miss "Spring" when the gap is
 *  late spring, and every plant recorded as blooming continuously. */
export const bloomAskUrl = (slot: BloomSlot): string =>
  `/?${encodeConstraints({
    atoms: periodsFor(slot).map((value) => ({ kind: "facet", key: "bloomPeriod", value })),
    text: "",
    view: "list",
  }).toString()}`;

/** Slot names as a spoken list, each a link that opens the guide on the
 *  plants recorded blooming then. A named gap becomes a gap she can shop. */
export function SlotLinks({
  slots,
  lower = true,
}: {
  slots: readonly BloomSlot[];
  lower?: boolean;
}) {
  const n = slots.length;
  return (
    <>
      {slots.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && (i === n - 1 ? (n > 2 ? ", and " : " and ") : ", ")}
          <Link to={bloomAskUrl(s)}>{lower ? s.toLowerCase() : s}</Link>
        </Fragment>
      ))}
    </>
  );
}
