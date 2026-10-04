import type { Listing, Priority, Transfer } from "./domain";
import { RECIPIENTS } from "./fixtures";
import { matchListing } from "./engine";

/** Browsing and AI explanations use the same current, unallocated capacity. */
export function currentMatches(
  listing: Listing,
  transfers: Transfer[],
  priority: Priority = "balanced",
) {
  const recipients = RECIPIENTS.map((recipient) => ({
    ...recipient,
    capacityKg: Math.max(
      0,
      recipient.capacityKg -
        transfers
          .filter(
            (t) =>
              t.recipientId === recipient.id &&
              ["proposed", "booked", "received", "disputed"].includes(t.status),
          )
          .reduce((sum, t) => sum + t.agreedKg, 0),
    ),
  }));
  return matchListing(listing, recipients, priority);
}
