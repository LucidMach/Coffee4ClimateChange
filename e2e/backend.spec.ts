import { test, expect } from "@playwright/test";

test("backend saves explanations using current capacity and restricts their retrieval to the owner", async ({
  request,
}) => {
  await request.post("/api/session", {
    data: { role: "cafe", businessId: "c-demo" },
  });
  const health = await (await request.get("/api/health")).json();
  expect(health).toMatchObject({
    status: "ready",
    storage: "local-sqlite",
    ai: { configured: false },
    supabase: { connected: false },
  });
  const initial = await (await request.get("/api/bootstrap")).json();
  const template = initial.listings.find(
    (l: { material: string }) => l.material === "grounds",
  );
  const now = Date.now();
  const created = await request.post("/api/listings", {
    data: {
      ...template,
      title: "AI backend capacity test",
      quantityKg: 12,
      collectedAt: new Date(now - 3600000).toISOString(),
      availableAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 8 * 3600000).toISOString(),
    },
  });
  expect(created.status()).toBe(201);
  const { listing } = await created.json();
  const proposal = await request.post("/api/transfers", {
    data: { listingId: listing.id, recipientId: "r-mushroom", quantityKg: 10 },
  });
  expect(proposal.ok()).toBe(true);
  const { transfer } = await proposal.json();
  const answer = await request.post("/api/explain", {
    data: { listingId: listing.id, recipientId: "r-mushroom" },
  });
  expect(answer.ok()).toBe(true);
  const { explanation } = await answer.json();
  expect(explanation).toMatchObject({
    mode: "rules",
    failureCode: "not_configured",
    usage: null,
    listingId: listing.id,
    supplierId: "c-demo",
    cached: false,
  });
  expect(explanation.summary).toContain("needs review");
  expect(explanation.summary).toContain("at least 5 kg");
  const saved = await request.get(`/api/explanations/${explanation.id}`);
  expect((await saved.json()).explanation.id).toBe(explanation.id);
  const after = await (await request.get("/api/health")).json();
  expect(after.ai.quota.used).toBe(health.ai.quota.used);
  await request.post("/api/session", {
    data: { role: "cafe", businessId: "c-river" },
  });
  expect(
    (await request.get(`/api/explanations/${explanation.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/explain", {
        data: { listingId: listing.id, recipientId: "r-mushroom" },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/session", {
    data: { role: "cafe", businessId: "c-demo" },
  });
  expect(
    (
      await request.post(`/api/transfers/${transfer.id}/action`, {
        data: { action: "cancel" },
      })
    ).ok(),
  ).toBe(true);
});

test("connection checks report missing keys without making model calls", async ({
  page,
}) => {
  const modelPosts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") modelPosts.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Backend connection status" }),
  ).toContainText("Local database ready");
  await page
    .getByRole("button", { name: "Check backend", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check backend", exact: true }),
  ).toBeEnabled();
  await page.getByText("Connect your API key", { exact: true }).click();
  await expect(page.locator(".workspace-stage")).toContainText(
    "npm run setup:local",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(modelPosts).toEqual([]);
});
