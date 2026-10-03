import { afterEach, expect, it, vi } from "vitest";
import { explainMatch } from "./ai";
import { matchListing } from "./engine";
import { RECIPIENTS, seedListings } from "./fixtures";
afterEach(() => vi.unstubAllEnvs());
it("uses a visible deterministic fallback without making an API call", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_MODEL", "");
  const listing = seedListings()[0],
    claim = vi.fn();
  const explanation = await explainMatch(
    listing,
    matchListing(listing, RECIPIENTS)[0],
    claim,
  );
  expect(explanation.mode).toBe("rules");
  expect(explanation.notice).toContain("no model call");
  expect(claim).not.toHaveBeenCalled();
  expect(explanation.uncertainties.join(" ")).toContain("sample data");
});
