import { NextResponse } from "next/server";
import { reserveSchema } from "@/lib/domain";
import { getStore } from "@/lib/store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const v = reserveSchema.parse(await request.json());
    return NextResponse.json(
      {
        transfer: getStore().reserve(
          v.listingId,
          v.recipientId,
          v.quantityKg,
          await getSession(),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
