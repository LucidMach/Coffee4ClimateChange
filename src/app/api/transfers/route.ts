import { NextResponse } from "next/server";
import { reserveSchema } from "@/lib/domain";
import { withJudgeStore } from "@/lib/judge-store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const v = reserveSchema.parse(await request.json()),
      session = await getSession();
    const transfer = await withJudgeStore(
      (db) => db.reserve(v.listingId, v.recipientId, v.quantityKg, session),
      { write: true },
    );
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
