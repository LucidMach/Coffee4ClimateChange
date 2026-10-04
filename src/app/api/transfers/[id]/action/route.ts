import { NextResponse } from "next/server";
import { actionSchema } from "@/lib/domain";
import { withJudgeStore } from "@/lib/judge-store";
import { apiError, getSession, guardMutation } from "@/lib/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    guardMutation(request);
    const { id } = await context.params;
    const action = actionSchema.parse(await request.json()),
      session = await getSession();
    const transfer = await withJudgeStore((db) => db.act(id, action, session), {
      write: true,
    });
    return NextResponse.json({ transfer });
  } catch (error) {
    return apiError(error);
  }
}
