import { test, expect } from "@playwright/test";

test("CSV purchasing planner compares costs, validates uploads and keeps data off the network", async ({
  page,
}) => {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST") calls.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Plan next bean order" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Try fictional sample" }).click();
  await dialog.getByLabel("Usable stock at start of plan (kg)").fill("5");
  await dialog.getByLabel("Confirmed incoming beans (kg)").fill("3");
  await dialog.getByLabel("Order pack size (kg)").fill("2");
  await dialog.getByLabel("Your original planned order (kg)").fill("60");
  await dialog.getByLabel("Purchase budget (AUD)").fill("1800");
  const result = dialog.getByRole("region", {
    name: "Bean purchase recommendation",
  });
  await expect(result).toContainText("50 kg");
  await expect(result).toContainText("$1,500");
  await expect(result).toContainText(
    "$300.00 lower than your original order plan",
  );
  await dialog.getByLabel("Business goal: usage change (%)").fill("100");
  await expect(result).toContainText("Above your budget");
  await expect(result).toContainText("more than your original order plan");
  await dialog.getByLabel("Bean cost (AUD/kg)").fill("");
  await expect(result).toBeHidden();
  await expect(dialog.getByRole("alert")).toContainText(
    "Fill all planning inputs",
  );
  await dialog.getByLabel("Bean cost (AUD/kg)").fill("30");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download purchase plan" }).click();
  expect((await download).suggestedFilename()).toBe("nile-bean-plan.csv");
  await dialog.getByLabel("Upload daily totals CSV").setInputFiles({
    name: "incomplete.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,beans_kg\n2026-09-01,4"),
  });
  await expect(dialog.getByRole("alert")).toContainText("at least 14");
  await expect(result).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Plan next bean order" }).click();
  await expect(page.getByRole("dialog")).not.toContainText(
    "Fictional sample · 28 days",
  );
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("collector cannot book before cafe readiness and revised briefs require reapproval", async ({
  page,
  request,
}) => {
  await request.post("/api/session", {
    data: { role: "cafe", businessId: "c-demo" },
  });
  const data = await (await request.get("/api/bootstrap")).json();
  const ground = data.listings.find(
    (l: { material: string }) => l.material === "grounds",
  );
  const now = Date.now();
  const listing = await (
    await request.post("/api/listings", {
      data: {
        ...ground,
        title: "Collection standards test batch",
        quantityKg: 10,
        collectedAt: new Date(now - 3600000).toISOString(),
        availableAt: new Date(now - 60000).toISOString(),
        expiresAt: new Date(now + 6 * 3600000).toISOString(),
      },
    })
  ).json();
  const transfer = await (
    await request.post("/api/transfers", {
      data: {
        listingId: listing.listing.id,
        recipientId: "r-mushroom",
        quantityKg: 10,
      },
    })
  ).json();
  const id = transfer.transfer.id;
  await page.goto("/");
  await page.getByRole("button", { name: "Handovers", exact: true }).click();
  const card = page
    .locator(".handover-card")
    .filter({ hasText: "Collection standards test batch" });
  await card.getByRole("button", { name: "Review as recipient" }).click();
  await expect(
    card.getByRole("button", { name: "Accept pickup" }),
  ).toBeDisabled();
  await page.getByLabel("Demo workspace").selectOption("cafe");
  await page.getByRole("button", { name: "Handovers", exact: true }).click();
  await card
    .getByLabel("Pickup contact", { exact: true })
    .fill("Demo cafe manager");
  await card
    .getByLabel("Pickup access instructions")
    .fill("Side entrance, labelled chilled containers.");
  await card
    .getByRole("checkbox", { name: /I have reviewed the batch weight/ })
    .check();
  await card.getByRole("button", { name: "Mark café ready" }).click();
  await card.getByRole("button", { name: "Review as recipient" }).click();
  await expect(card).toContainText(
    "Side entrance, labelled chilled containers.",
  );
  await card.getByRole("checkbox", { name: /I can accept this batch/ }).check();
  await card.getByRole("button", { name: "Accept pickup" }).click();
  await expect(
    card.getByRole("button", { name: "Record receipt" }),
  ).toBeEnabled();
  await page.getByLabel("Demo workspace").selectOption("cafe");
  await page.getByRole("button", { name: "Handovers", exact: true }).click();
  await card
    .getByLabel("Pickup access instructions")
    .fill("Revised: collect at front entrance.");
  await card
    .getByRole("checkbox", { name: /I have reviewed the batch weight/ })
    .check();
  await card
    .getByRole("button", { name: "Save revised collection brief" })
    .click();
  await card.getByRole("button", { name: "Open recipient view" }).click();
  await expect(
    card.getByRole("button", { name: "Record receipt" }),
  ).toBeDisabled();
  await card.getByRole("checkbox", { name: /I can accept this batch/ }).check();
  await card.getByRole("button", { name: "Confirm revised pickup" }).click();
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "Download pickup brief" }).click();
  expect((await download).suggestedFilename()).toBe(
    `nile-collection-${id.slice(0, 8)}.txt`,
  );
  await page.reload();
  await expect(card).toContainText("Revised: collect at front entrance.");
  await expect(card).toContainText("Both sides confirmed");
  await card
    .getByRole("button", { name: "Cancel this handover and release the batch" })
    .click();
  await expect(card.getByText("Cancelled", { exact: true })).toBeVisible();
});

test("phone purchase planner remains readable and participation record is scoped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Demo workspace").selectOption("cafe");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const adoption = page.getByRole("region", { name: "Café adoption tools" });
  await expect(adoption).toContainText(
    "No COP31 accreditation or B Corp certification is claimed",
  );
  await expect(
    adoption.getByRole("button", { name: "Download participation record" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Plan next bean order" }).click();
  await page.getByRole("button", { name: "Try fictional sample" }).click();
  const dialog = page.getByRole("dialog");
  const dimensions = await dialog.evaluate((el) => ({
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  await expect(
    dialog.getByRole("region", { name: "Bean purchase recommendation" }),
  ).toContainText("Suggested purchase");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
