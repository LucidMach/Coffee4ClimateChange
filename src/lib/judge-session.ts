import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export const JUDGE_COOKIE = "nile-judge-workspace";
export const JUDGE_HEADER = "x-nile-judge-workspace";
export const JUDGE_MAX_AGE = 7 * 86400;
export function judgeDemoEnabled() {
  return process.env.NILE_JUDGE_DEMO === "1";
}
function signingSecret() {
  const secret = process.env.NILE_DEMO_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Judge demo signing secret is missing.");
  return secret;
}
/** An opaque capability identifies one browser's sample-only workspace, not an account. */
export function createJudgeToken(now = Date.now()) {
  const payload = `${randomBytes(24).toString("hex")}.${Math.floor(now / 1000)}`;
  return `${payload}.${createHmac("sha256", signingSecret()).update(payload).digest("hex")}`;
}
export function validateJudgeToken(
  token: string | undefined,
  now = Date.now(),
) {
  if (!token || !/^[a-f0-9]{48}\.[0-9]{10}\.[a-f0-9]{64}$/.test(token))
    return null;
  const [id, created, mac] = token.split(".");
  const age = Math.floor(now / 1000) - Number(created);
  if (age < -60 || age > JUDGE_MAX_AGE) return null;
  const expected = createHmac("sha256", signingSecret())
    .update(`${id}.${created}`)
    .digest();
  return timingSafeEqual(Buffer.from(mac, "hex"), expected) ? id : null;
}
export async function getJudgeWorkspaceId() {
  const incoming = await headers();
  const cookieJar = await cookies();
  const id =
    validateJudgeToken(incoming.get(JUDGE_HEADER) ?? undefined) ??
    validateJudgeToken(cookieJar.get(JUDGE_COOKIE)?.value);
  return id;
}
