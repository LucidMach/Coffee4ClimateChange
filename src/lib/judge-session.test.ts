import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJudgeToken,
  validateJudgeToken,
  JUDGE_MAX_AGE,
} from "./judge-session";
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
describe("judge workspace capabilities", () => {
  beforeEach(() =>
    vi.stubEnv(
      "NILE_DEMO_SECRET",
      "nile-isolated-test-secret-01234567890123456789",
    ),
  );
  afterEach(() => vi.unstubAllEnvs());
  it("accepts a signed capability but rejects a changed ID or signature", () => {
    const token = createJudgeToken();
    expect(validateJudgeToken(token)).toMatch(/^[a-f0-9]{48}$/);
    expect(
      validateJudgeToken(`${token[0] === "a" ? "b" : "a"}${token.slice(1)}`),
    ).toBeNull();
    expect(
      validateJudgeToken(
        token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a"),
      ),
    ).toBeNull();
  });
  it("isolates browsers and expires their sample-data capability", () => {
    const now = Date.now();
    const first = createJudgeToken(now),
      second = createJudgeToken(now);
    expect(validateJudgeToken(first)).not.toBe(validateJudgeToken(second));
    expect(
      validateJudgeToken(first, now + (JUDGE_MAX_AGE + 1) * 1000),
    ).toBeNull();
    expect(validateJudgeToken(first, now - 61000)).toBeNull();
    expect(validateJudgeToken("../another-workspace")).toBeNull();
  });
});
