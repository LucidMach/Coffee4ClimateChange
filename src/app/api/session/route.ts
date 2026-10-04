import { NextResponse } from "next/server";
import { sessionSchema } from "@/lib/domain";
import { apiError, guardMutation, validSession } from "@/lib/server";
import { DomainError } from "@/lib/store";
export async function POST(request: Request) {
  try {
    guardMutation(request);
    const session = sessionSchema.parse(await request.json());
    if (!validSession(session))
      throw new DomainError("Choose a known demo workspace.", 400);
    const response = NextResponse.json({ session });
    response.cookies.set("nile-demo-session", JSON.stringify(session), {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
