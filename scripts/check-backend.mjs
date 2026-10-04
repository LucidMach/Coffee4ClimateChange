const base = process.env.NILE_CHECK_URL || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error("This checker is for a local Nile server.");
async function request(path, data) {
  const response = await fetch(new URL(path, base), {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(16000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
const health = await request("/api/health");
console.log(JSON.stringify(health, null, 2));
if (process.argv.includes("--live-ai")) {
  if (!health.ai.configured)
    throw new Error(
      "Add OPENAI_API_KEY and OPENAI_MODEL to .env.local and restart the server first. No model call was made.",
    );
  // The normal explanation endpoint checks ownership, current capacity, caches
  // identical inputs and claims a request against the persistent daily limit.
  const data = await request("/api/bootstrap");
  const listing = data.listings.find(
    (l) =>
      l.supplierId === data.session.businessId &&
      l.availableKg > 0 &&
      Date.parse(l.expiresAt) > Date.now(),
  );
  if (!listing)
    throw new Error(
      "The default supplier needs an available batch. Use npm run demo:reset if appropriate.",
    );
  const matches = await request(
    `/api/listings/${encodeURIComponent(listing.id)}/matches`,
  );
  const match = matches.matches.find((m) => m.eligibility === "eligible");
  if (!match)
    throw new Error(
      "No eligible recipient for this batch. Try the app’s Explain this match button on another batch.",
    );
  const { explanation } = await request("/api/explain", {
    listingId: listing.id,
    recipientId: match.recipient.id,
    refresh: true,
  });
  console.log(
    JSON.stringify(
      {
        id: explanation.id,
        mode: explanation.mode,
        model: explanation.model,
        usage: explanation.usage,
        cached: explanation.cached,
        failureCode: explanation.failureCode,
        notice: explanation.notice,
      },
      null,
      2,
    ),
  );
  if (explanation.mode !== "openai") process.exitCode = 1;
}
