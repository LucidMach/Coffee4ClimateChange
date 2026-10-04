import { NextRequest, NextResponse } from "next/server";
import {
  JUDGE_COOKIE,
  JUDGE_HEADER,
  JUDGE_MAX_AGE,
  createJudgeToken,
  judgeDemoEnabled,
  validateJudgeToken,
} from "./lib/judge-session";

/** Assign isolated sample data before rendering, including the first page/API request. */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(JUDGE_HEADER);
  if (!judgeDemoEnabled())
    return NextResponse.next({ request: { headers: requestHeaders } });
  const existing = request.cookies.get(JUDGE_COOKIE)?.value;
  const token = validateJudgeToken(existing) ? existing! : createJudgeToken();
  requestHeaders.set(JUDGE_HEADER, token);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (token !== existing)
    response.cookies.set(JUDGE_COOKIE, token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      // Preserve a returning judge's workspace when opening an external pitch link.
      // Mutations still require JSON and an exact same-origin Origin header.
      sameSite: "lax",
      path: "/",
      maxAge: JUDGE_MAX_AGE,
    });
  return response;
}
export const config = { matcher: ["/", "/api/:path*"] };
