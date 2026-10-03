import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { RECIPIENTS } from "@/lib/fixtures";
import { matchListing } from "@/lib/engine";
import { apiError } from "@/lib/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      db = getStore();
    const priority = z
      .enum(["balanced", "value", "distance"])
      .parse(new URL(request.url).searchParams.get("priority") || "balanced");
    const transfers = db.transfers();
    const recipients = RECIPIENTS.map((r) => ({
      ...r,
      capacityKg: Math.max(
        0,
        r.capacityKg -
          transfers
            .filter(
              (t) =>
                t.recipientId === r.id &&
                ["proposed", "booked", "received", "disputed"].includes(
                  t.status,
                ),
            )
            .reduce((n, t) => n + t.agreedKg, 0),
      ),
    }));
    return NextResponse.json(
      { matches: matchListing(db.listing(id), recipients, priority) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
