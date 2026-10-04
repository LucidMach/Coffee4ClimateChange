import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { createExplanation } from "@/lib/explanation-service";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const { listingId, recipientId, priority, refresh } = z
      .object({
        listingId: z.string().min(1).max(80),
        recipientId: z.string().min(1).max(80),
        priority: z.enum(["balanced", "value", "distance"]).default("balanced"),
        refresh: z.boolean().default(false),
      })
      .parse(await request.json());
    const db = getStore(),
      session = await getSession();
    return NextResponse.json({
      explanation: await createExplanation(
        db,
        session,
        listingId,
        recipientId,
        priority,
        refresh,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
