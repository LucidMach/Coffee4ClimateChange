import { test, expect, type Locator, type Page } from "@playwright/test";

async function prepareCollection(scope: Page | Locator) {
  await scope
    .getByLabel("Pickup contact", { exact: true })
    .fill("Demo manager 0400 000 000");
  await scope
    .getByLabel("Pickup access instructions")
    .fill("Collect labelled containers at rear entrance.");
  await scope
    .getByRole("checkbox", { name: /I have reviewed the batch weight/ })
    .check();
  await scope.getByRole("button", { name: "Mark café ready" }).click();
  await expect(
    scope.getByText("Recipient review needed", { exact: true }),
  ).toBeVisible();
}
async function acceptCollection(scope: Page | Locator) {
  await scope
    .getByRole("checkbox", { name: /I can accept this batch/ })
    .check();
  await scope.getByRole("button", { name: "Accept pickup" }).click();
  await expect(
    scope.getByText("Both sides confirmed", { exact: true }),
  ).toBeVisible();
}

test("Australian potential is an editable sourced illustration and stays separate from recorded savings", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const metrics = page.getByRole("region", {
    name: "Coffee and climate metrics",
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Less coffee waste. Less methane.",
  );
  await expect(page.locator(".story-topline")).toContainText("COP31");
  const methane = metrics
    .locator(".metric")
    .filter({ hasText: "Methane potentially avoided" });
  const outreach = metrics
    .locator(".metric")
    .filter({ hasText: "Café outreach target" });
  await expect(metrics).toContainText("75,000");
  await expect(methane).toContainText("55.7");
  await expect(methane).toContainText("tonnes methane");
  await expect(methane).toContainText("Lifetime estimate · food-waste proxy");
  await expect(outreach).toContainText("~282");
  await expect(outreach).toContainText("not yet contacted");
  await expect(metrics).not.toContainText("GHG reduction");
  const share = page.getByRole("slider", {
    name: "Share of Australian grounds diverted",
  });
  await expect(share).toHaveAttribute("min", "1");
  await expect(share).toHaveAttribute("max", "10");
  await expect(share).toHaveAttribute("step", "0.5");
  await share.focus();
  await page.keyboard.press("ArrowRight");
  await expect(share).toHaveValue("1.5");
  await expect(metrics).toContainText("1,125");
  await expect(methane).toContainText("83.5");
  await expect(outreach).toContainText("~422");
  await page.keyboard.press("End");
  await expect(share).toHaveValue("10");
  await expect(metrics).toContainText("7,500");
  await expect(outreach).toContainText("~2,815");
  await page.keyboard.press("ArrowRight");
  await expect(share).toHaveValue("10");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  await expect(share).toHaveValue("1");
  await page.getByRole("button", { name: "Assumptions & sources" }).click();
  const method = page.getByRole("dialog");
  await expect(method).toContainText(
    "has not been validated for coffee grounds",
  );
  await expect(
    method.getByRole("link", { name: "RMIT · 23 August 2023" }),
  ).toHaveAttribute(
    "href",
    "https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete",
  );
  await expect(
    method.getByRole("link", { name: "IBISWorld · October 2025, page 1" }),
  ).toHaveAttribute(
    "href",
    "https://arca.org.au/wp-content/uploads/2025/12/IBISWorld2025.pdf",
  );
  await expect(method).toContainText("two separate goals");
  await page.getByLabel("Landfill gas captured (%)").fill("100");
  await expect(method).toContainText("-0.6 tonnes methane");
  await expect(method).toContainText("Negative results mean");
  await page.keyboard.press("Escape");
  await expect(method).toBeHidden();
  await page.getByRole("button", { name: "Workspace results" }).click();
  await expect(
    metrics.locator(".metric").filter({ hasText: "CO₂e avoided" }),
  ).toContainText("Not known");
  await expect(
    metrics.locator(".metric").filter({ hasText: "Waste reported reused" }),
  ).toContainText("0 kg");
});

test("grounds and beans complete the two-sided workflow with separate use reporting", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace results" }).click();
  const openingMetrics = page.getByRole("region", {
    name: "Coffee and climate metrics",
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Find a next use", exact: true })
    .click();
  const grower = page
    .locator(".match-card")
    .filter({ hasText: "Loop Mushroom Co." });
  await expect(grower.getByText("Compatible", { exact: true })).toBeVisible();
  await expect(
    page.locator(".match-card").filter({ hasText: "Freshcap Studio" }),
  ).toContainText("Needs at least 50 kg");
  await grower.getByRole("button", { name: "Explain this match" }).click();
  await expect(page.locator(".explanation")).toContainText("no model call");
  await grower.getByRole("button", { name: "Propose handover" }).click();
  await expect(
    page.getByText("Awaiting recipient", { exact: true }),
  ).toBeVisible();
  await prepareCollection(page);
  await page.getByRole("button", { name: "Review as recipient" }).click();
  await acceptCollection(
    page
      .locator(".handover-card")
      .filter({ hasText: "This morning’s coffee grounds" }),
  );
  await page.getByLabel("Actual accepted weight (kg)").fill("27");
  await page.getByRole("button", { name: "Record receipt" }).click();
  await page.getByRole("button", { name: "Review as supplier" }).click();
  await expect(page.getByText("27 kg recorded by recipient")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await expect(page.getByText("27 kg transfer confirmed")).toBeVisible();
  await expect(
    openingMetrics
      .locator(".metric")
      .filter({ hasText: "Waste reported reused" }),
  ).toContainText("0 kg");
  await page.getByRole("button", { name: "Open recipient view" }).click();
  await page.getByLabel("Amount used (kg)").fill("25");
  await page
    .getByLabel("How was it used?")
    .fill("Added to a prepared mushroom substrate in this sample demo.");
  await page.getByRole("button", { name: "Save use report" }).click();
  await expect(page.getByText("25 kg reported used")).toBeVisible();
  await page.getByLabel("Demo workspace").selectOption("cafe");
  await expect(
    page.getByRole("heading", { name: "Your coffee, its next chapter." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My materials", exact: true }).click();
  const beans = page
    .locator(".listing-row")
    .filter({ hasText: "Surplus house-blend beans" });
  await beans.getByRole("button", { name: "Find matches" }).click();
  await page.getByRole("button", { name: "Propose handover" }).click();
  const beanTransfer = page
    .locator(".handover-card")
    .filter({ hasText: "Surplus house-blend beans" });
  await beanTransfer
    .getByRole("button", { name: "Reuse last pickup contact & access" })
    .click();
  await expect(
    beanTransfer.getByLabel("Pickup contact", { exact: true }),
  ).toHaveValue("Demo manager 0400 000 000");
  await prepareCollection(beanTransfer);
  await beanTransfer
    .getByRole("button", { name: "Review as recipient" })
    .click();
  await acceptCollection(beanTransfer);
  await page.getByRole("button", { name: "Record receipt" }).click();
  await page.getByRole("button", { name: "Review as supplier" }).click();
  await page
    .locator(".handover-card")
    .filter({ hasText: "Surplus house-blend beans" })
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await page
    .locator(".handover-card")
    .filter({ hasText: "Surplus house-blend beans" })
    .getByRole("button", { name: "Open recipient view" })
    .click();
  await page
    .getByLabel("How was it used?")
    .fill("All six kilograms brewed as coffee at the sample café.");
  await page.getByRole("button", { name: "Save use report" }).click();
  await page.getByLabel("Demo workspace").selectOption("network");
  await expect(
    openingMetrics
      .locator(".metric")
      .filter({ hasText: "Waste reported reused" }),
  ).toContainText("25 kg");
  await expect(
    openingMetrics.locator(".metric").filter({ hasText: "Beans kept in use" }),
  ).toContainText("6 kg");
  await expect(
    openingMetrics.locator(".metric").filter({ hasText: "CO₂e avoided" }),
  ).toContainText("Not known");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Confirmed transfers" }),
  ).toContainText("33 kg");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Waste reported reused" }),
  ).toContainText("25 kg");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Beans kept in use" }),
  ).toContainText("6 kg");
  await expect(
    page.locator(".metric").filter({ hasText: "Climate benefit" }),
  ).toContainText("Not known");
  await page.reload();
  await expect(
    page.locator(".metric").filter({ hasText: "Confirmed transfers" }),
  ).toContainText("33 kg");
  await page.getByLabel("Demo workspace").selectOption("cafe");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const participation = page.locator(".participation-card");
  await expect(participation).toContainText("2 confirmed handovers");
  await expect(participation).toContainText(
    "33 kg transferred · 31 kg reported used",
  );
  const record = page.waitForEvent("download");
  await participation
    .getByRole("button", { name: "Download participation record" })
    .click();
  expect((await record).suggestedFilename()).toBe(
    "nile-demo-participation-record.txt",
  );
  expect(errors).toEqual([]);
});

test("a measured listing saves from the form and persists after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "New listing", exact: true }).click();
  await page.getByLabel("Listing title").fill("E2E measured grounds batch");
  await page.getByLabel("Measured quantity (kg)").fill("15");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // A future pickup window is intentional for a newly listed batch.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create listing & find matches" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find the right next use" }),
  ).toBeVisible();
  await expect(
    page.locator(".match-card").filter({ hasText: "Loop Mushroom Co." }),
  ).toContainText("Not known");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  await page.getByRole("button", { name: "My materials", exact: true }).click();
  await expect(
    page
      .locator(".listing-row")
      .filter({ hasText: "E2E measured grounds batch" }),
  ).toContainText("15");
});

test("API concurrency cannot double reserve a batch and cross-origin writes are rejected", async ({
  request,
}) => {
  await request.post("/api/session", {
    data: { role: "cafe", businessId: "c-demo" },
  });
  const bootstrap = await (await request.get("/api/bootstrap")).json();
  const ground = bootstrap.listings.find(
    (l: { material: string }) => l.material === "grounds",
  );
  const created = await request.post("/api/listings", {
    data: {
      ...ground,
      title: "Isolated concurrent reservation test",
      quantityKg: 15,
      availableAt: new Date(Date.now() - 60000).toISOString(),
      collectedAt: new Date(Date.now() - 3600000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  expect(created.status()).toBe(201);
  const { listing } = await created.json();
  const body = {
    listingId: listing.id,
    recipientId: "r-mushroom",
    quantityKg: 15,
  };
  const results = await Promise.all([
    request.post("/api/transfers", { data: body }),
    request.post("/api/transfers", { data: body }),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
  const crossOrigin = await request.post("/api/session", {
    data: { role: "network", businessId: "c-demo" },
    headers: { Origin: "https://example.com" },
  });
  expect(crossOrigin.status()).toBe(403);
  const malformed = await request.post("/api/listings", {
    data: { material: "grounds", quantityKg: -1 },
  });
  expect(malformed.status()).toBe(400);
});

test("mobile navigation and modal remain usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace results" }).click();
  const metrics = page.getByRole("region", {
    name: "Coffee and climate metrics",
  });
  const emissions = metrics
    .locator(".metric")
    .filter({ hasText: "CO₂e avoided" });
  await emissions.scrollIntoViewIfNeeded();
  const rowBox = await metrics.boundingBox();
  const emissionsBox = await emissions.boundingBox();
  expect(emissionsBox!.x).toBeGreaterThanOrEqual(rowBox!.x - 1);
  expect(emissionsBox!.x + emissionsBox!.width).toBeLessThanOrEqual(
    rowBox!.x + rowBox!.width + 1,
  );
  await expect(emissions).toContainText("Not known");
  await expect(
    page.getByRole("button", { name: "My materials", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Coffee pathways", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Coffee cherry pulp" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "My materials", exact: true }).click();
  await page.getByRole("button", { name: "New listing", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-materials.png",
    fullPage: true,
  });
});

test("coffee animates without playback controls and respects reduced motion", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const entry = page.locator(".coffee-entry");
  await page.clock.runFor(100);
  await expect(entry).toHaveAttribute("data-journey-mode", "paused");
  await expect(entry).toHaveAttribute("data-cycle-progress", "0.000");
  await expect(page.locator(".journey-controls")).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "Coffee journey progress", exact: true }),
  ).toHaveCount(0);
  await page.clock.runFor(8000);
  await expect(entry).toHaveAttribute("data-cycle-progress", "0.000");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(entry).toHaveAttribute("data-journey-mode", "loop");
  await expect
    .poll(async () => Number(await entry.getAttribute("data-cycle-progress")))
    .toBeGreaterThan(0);
  await page.clock.runFor(8600);
  await expect(entry).toHaveAttribute("data-coffee-phase", "Latte");
  await expect(page.locator(".journey-latte")).toHaveAttribute("opacity", "1");
  await page.clock.runFor(5000);
  await expect(entry).toHaveAttribute("data-coffee-phase", "Spent grounds");
  await expect(page.locator(".journey-grounds")).toHaveAttribute(
    "opacity",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(entry).toHaveAttribute("data-journey-mode", "paused");
  await page.clock.runFor(100);
  const paused = await entry.getAttribute("data-cycle-progress");
  await page.clock.runFor(2000);
  await expect(entry).toHaveAttribute("data-cycle-progress", paused!);
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
  await page.clock.runFor(700);
  await expect(entry).toHaveAttribute("data-journey-mode", "paused");
  await expect(page.locator(".falling-grounds")).toHaveAttribute(
    "data-fall-progress",
    "0.00",
  );
  expect(runtimeErrors).toEqual([]);
});

test("stage selector sticks while browsing and the keyboard slider switches the working panel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".workspace-window")).toBeHidden();
  await page.getByRole("button", { name: "My materials", exact: true }).click();
  await expect(page.locator(".workspace-window")).toBeVisible();
  await expect(page.locator(".workspace-stage")).toHaveAttribute(
    "data-stage",
    "listings",
  );
  await page.evaluate(() => window.scrollBy(0, 160));
  const dock = await page.locator(".engine-dock").boundingBox();
  expect(dock?.y).toBeGreaterThanOrEqual(83);
  expect(dock?.y).toBeLessThanOrEqual(85);
  const slider = page.getByRole("slider", {
    name: "Workspace stage",
    exact: true,
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".workspace-stage")).toHaveAttribute(
    "data-stage",
    "handovers",
  );
  await expect(slider).toHaveValue("2");
  await page.getByRole("button", { name: "Next workspace stage" }).click();
  await expect(page.locator(".workspace-stage")).toHaveAttribute(
    "data-stage",
    "impact",
  );
});

test("coffee loops at the top, follows scrolling into the circles and reverses on return", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.clock.runFor(100);
  const entry = page.locator(".coffee-entry");
  const particles = page.locator(".falling-grounds");
  const story = await page.locator(".coffee-story").boundingBox();
  expect(story!.y + story!.height).toBeLessThanOrEqual(1000);
  await expect(entry).toHaveAttribute("data-journey-mode", "loop");
  await page.clock.runFor(14800);
  const beforeLoop = Number(await entry.getAttribute("data-cycle-progress"));
  expect(beforeLoop).toBeGreaterThan(0.6);
  await page.clock.runFor(1800);
  expect(Number(await entry.getAttribute("data-cycle-progress"))).toBeLessThan(
    0.12,
  );
  await expect(particles).toHaveAttribute("data-fall-progress", "0.00");
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
  await page.clock.runFor(700);
  await expect(entry).toHaveAttribute("data-journey-mode", "scroll");
  const middle = Number(await particles.getAttribute("data-fall-progress"));
  expect(middle).toBeGreaterThan(0);
  expect(middle).toBeLessThan(1);
  await expect(entry).toHaveAttribute("data-coffee-phase", "Spent grounds");
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
  );
  await page.clock.runFor(900);
  await expect(particles).toHaveAttribute("data-fall-progress", "1.00");
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.clock.runFor(900);
  await expect(entry).toHaveAttribute("data-journey-mode", "loop");
  await expect(particles).toHaveAttribute("data-fall-progress", "0.00");
  const resumed = Number(await entry.getAttribute("data-cycle-progress"));
  await page.clock.runFor(1000);
  expect(
    Number(await entry.getAttribute("data-cycle-progress")),
  ).toBeGreaterThan(resumed);
});
