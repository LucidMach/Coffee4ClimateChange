import { NextResponse } from "next/server";
import { listingInputSchema } from "@/lib/domain";
import { withJudgeStore } from "@/lib/judge-store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const input = listingInputSchema.parse(await request.json()),
      session = await getSession();
    const listing = await withJudgeStore(
      (db) => db.createListing(input, session),
      { write: true },
    );
    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
