import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { Responses } from "openai/resources/responses/responses";
import { explainMatch } from "./ai";
import { matchListing } from "./engine";
import { RECIPIENTS, seedListings } from "./fixtures";
import { NileStore } from "./store";
import { createExplanation } from "./explanation-service";
import { currentMatches } from "./matching";

const payload = {
  status: "completed",
  id: "resp_mock",
  model: "gpt-4.1-mini",
  output_parsed: {
    summary: "Sample grower meets the supplied requirements.",
    nextSteps: ["Review requirements before proposing."],
    uncertainties: ["Sample terms; climate impact unknown."],
  },
  usage: { input_tokens: 120, output_tokens: 60, total_tokens: 180 },
};
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "unit-test-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network call in unit test");
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("parses a model response, records actual usage and supplies no mutation tools", async () => {
  const parse = vi
    .spyOn(Responses.prototype, "parse")
    .mockResolvedValue(payload as never);
  const listing = seedListings()[0],
    claim = vi.fn();
  const result = await explainMatch(
    listing,
    matchListing(listing, RECIPIENTS)[0],
    claim,
  );
  expect(result).toMatchObject({
    mode: "openai",
    responseId: "resp_mock",
    usage: { inputTokens: 120, outputTokens: 60, totalTokens: 180 },
    failureCode: null,
  });
  expect(claim).toHaveBeenCalledOnce();
  expect(parse.mock.calls[0][0]).toMatchObject({
    store: false,
    max_output_tokens: 900,
  });
  expect(parse.mock.calls[0][0]).not.toHaveProperty("tools");
});
it("rejects refusals, incomplete responses and invalid schemas", async () => {
  const parse = vi.spyOn(Responses.prototype, "parse");
  for (const bad of [
    { ...payload, output_parsed: null },
    { ...payload, status: "incomplete" },
    { ...payload, output_parsed: { summary: 10 } },
  ]) {
    parse.mockResolvedValue(bad as never);
    const listing = seedListings()[0];
    const result = await explainMatch(
      listing,
      matchListing(listing, RECIPIENTS)[0],
      vi.fn(),
    );
    expect(result.mode).toBe("rules");
    expect(result.failureCode).toBe("invalid_response");
  }
});
it("sanitizes provider failures and never returns raw credentials or errors", async () => {
  vi.spyOn(Responses.prototype, "parse").mockRejectedValue(
    new OpenAI.AuthenticationError(
      401,
      {},
      "raw secret-like error",
      new Headers(),
    ),
  );
  const listing = seedListings()[0];
  const result = await explainMatch(
    listing,
    matchListing(listing, RECIPIENTS)[0],
    vi.fn(),
  );
  expect(result.failureCode).toBe("credentials");
  expect(JSON.stringify(result)).not.toContain("raw secret");
});
it("does not hide the persisted daily quota failure as a provider fallback", async () => {
  const parse = vi.spyOn(Responses.prototype, "parse");
  const listing = seedListings()[0];
  await expect(
    explainMatch(listing, matchListing(listing, RECIPIENTS)[0], () => {
      throw new Error("quota reached");
    }),
  ).rejects.toThrow("quota reached");
  expect(parse).not.toHaveBeenCalled();
});
it("deduplicates concurrent requests, saves a reviewable result, and invalidates changed capacity", async () => {
  const parse = vi
    .spyOn(Responses.prototype, "parse")
    .mockResolvedValue(payload as never);
  const db = new NileStore(":memory:");
  const session = { role: "cafe" as const, businessId: "c-demo" };
  try {
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        createExplanation(db, session, "l-grounds", "r-mushroom"),
      ),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(parse).toHaveBeenCalledOnce();
    expect(db.explanation(results[0].id)).toEqual(results[0]);
    expect(
      (await createExplanation(db, session, "l-grounds", "r-mushroom")).cached,
    ).toBe(true);
    db.reserve("l-grounds", "r-mushroom", 5, session);
    expect(
      currentMatches(db.listing("l-grounds"), db.transfers()).find(
        (m) => m.recipient.id === "r-mushroom",
      )?.recipient.capacityKg,
    ).toBe(95);
    await createExplanation(db, session, "l-grounds", "r-mushroom");
    expect(parse).toHaveBeenCalledTimes(2);
    await createExplanation(
      db,
      session,
      "l-grounds",
      "r-mushroom",
      "balanced",
      true,
    );
    expect(parse).toHaveBeenCalledTimes(3);
    expect(db.aiUsage().used).toBe(3);
    await expect(
      createExplanation(
        db,
        { role: "cafe", businessId: "c-river" },
        "l-grounds",
        "r-mushroom",
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(parse).toHaveBeenCalledTimes(3);
  } finally {
    db.close();
  }
});
