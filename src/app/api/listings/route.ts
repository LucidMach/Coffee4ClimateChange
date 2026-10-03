import { NextResponse } from "next/server";
import { listingInputSchema } from "@/lib/domain";
import { getStore } from "@/lib/store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const input = listingInputSchema.parse(await request.json());
    return NextResponse.json(
      { listing: getStore().createListing(input, await getSession()) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
