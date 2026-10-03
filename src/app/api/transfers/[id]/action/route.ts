import { NextResponse } from "next/server";
import { actionSchema } from "@/lib/domain";
import { getStore } from "@/lib/store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    guardMutation(request);
    const { id } = await context.params;
    const action = actionSchema.parse(await request.json());
    return NextResponse.json({
      transfer: getStore().act(id, action, await getSession()),
    });
  } catch (error) {
    return apiError(error);
  }
}
