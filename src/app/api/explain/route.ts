import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore, DomainError } from "@/lib/store";
import { RECIPIENTS } from "@/lib/fixtures";
import { matchListing } from "@/lib/engine";
import { explainMatch } from "@/lib/ai";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const { listingId, recipientId } = z
      .object({ listingId: z.string(), recipientId: z.string() })
      .parse(await request.json());
    const db = getStore(),
      listing = db.listing(listingId),
      session = await getSession();
    if (session.role !== "cafe" || session.businessId !== listing.supplierId)
      throw new DomainError(
        "Open explanations from the supplier workspace.",
        403,
      );
    const match = matchListing(listing, RECIPIENTS).find(
      (m) => m.recipient.id === recipientId,
    );
    if (!match) throw new DomainError("Match not found.", 404);
    return NextResponse.json({
      explanation: await explainMatch(listing, match, () => db.claimAiCall()),
    });
  } catch (error) {
    return apiError(error);
  }
}
