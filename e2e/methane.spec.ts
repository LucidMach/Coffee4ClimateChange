import {
  test as base,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Bootstrap, Listing, Transfer } from "../src/lib/domain";

// The ordinary workflow suite asserts its own aggregate totals. Give these
// completed sample transfers an independent local SQLite database and server.
const test = base.extend<Record<never, never>, { methaneServer: string }>({
  methaneServer: [
    async ({}, provide) => {
      const socket = createServer();
      await new Promise<void>((done) => socket.listen(0, "127.0.0.1", done));
      const address = socket.address();
      if (!address || typeof address === "string")
        throw new Error("Unable to allocate a local methane test port.");
      const port = address.port;
      await new Promise<void>((done, reject) =>
        socket.close((error) => (error ? reject(error) : done())),
      );
      const directory = await mkdtemp(join(tmpdir(), "nile-methane-e2e-"));
      const url = `http://127.0.0.1:${port}`;
      const server = spawn(
        process.execPath,
        [
          resolve("node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          env: {
            ...process.env,
            NILE_DB_PATH: join(directory, "methane.sqlite"),
            NILE_JUDGE_DEMO: "0",
            OPENAI_API_KEY: "",
            OPENAI_MODEL: "",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let logs = "";
      const capture = (chunk: Buffer) => {
        logs = (logs + chunk.toString()).slice(-6000);
      };
      server.stdout.on("data", capture);
      server.stderr.on("data", capture);
      try {
        const deadline = Date.now() + 30000;
        let ready = false;
        while (Date.now() < deadline && server.exitCode === null) {
          try {
            ready = (await fetch(`${url}/api/health`)).ok;
          } catch {
            // Wait for Next to open the allocated port.
          }
          if (ready) break;
          await new Promise((done) => setTimeout(done, 100));
        }
        if (!ready)
          throw new Error(`Methane test server did not start.\n${logs}`);
        await provide(url);
      } finally {
        if (server.exitCode === null) {
          const exited = once(server, "exit");
          server.kill("SIGTERM");
          const timeout = setTimeout(() => server.kill("SIGKILL"), 2000);
          await exited;
          clearTimeout(timeout);
        }
        await rm(directory, { recursive: true, force: true });
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ methaneServer }, provide) => provide(methaneServer),
});

async function session(
  request: APIRequestContext,
  role: "cafe" | "recipient" | "network",
  businessId: string,
) {
  const response = await request.post("/api/session", {
    data: { role, businessId },
  });
  expect(response.status(), await response.text()).toBe(200);
}

async function bootstrap(request: APIRequestContext): Promise<Bootstrap> {
  const response = await request.get("/api/bootstrap");
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function action(
  request: APIRequestContext,
  transfer: Transfer,
  data: Record<string, unknown>,
) {
  const response = await request.post(`/api/transfers/${transfer.id}/action`, {
    data,
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).transfer as Transfer;
}

async function completedBatch(
  request: APIRequestContext,
  title: string,
  {
    material = "grounds",
    recipientId = "r-compost",
    agreedKg = 20,
    acceptedKg = 18,
    usedKg = 12,
  }: {
    material?: "grounds" | "beans";
    recipientId?: string;
    agreedKg?: number;
    acceptedKg?: number;
    usedKg?: number | null;
  } = {},
) {
  await session(request, "cafe", "c-demo");
  const initial = await bootstrap(request);
  const seed = initial.listings.find(
    (listing) => listing.material === material,
  );
  expect(seed).toBeDefined();
  const now = Date.now();
  const response = await request.post("/api/listings", {
    data: {
      ...seed!,
      title,
      quantityKg: agreedKg,
      collectedAt: new Date(now - 3600000).toISOString(),
      availableAt: new Date(now - 60000).toISOString(),
      expiresAt: new Date(now + 6 * 3600000).toISOString(),
      notes: "Fictional methane verification batch; no real climate outcome.",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const listing: Listing = (await response.json()).listing;
  const reserved = await request.post("/api/transfers", {
    data: { listingId: listing.id, recipientId, quantityKg: agreedKg },
  });
  expect(reserved.status(), await reserved.text()).toBe(201);
  let transfer: Transfer = (await reserved.json()).transfer;
  transfer = await action(request, transfer, {
    action: "prepare_collection",
    revision: 0,
    contact: "Sample manager 0400 000 000",
    accessNote: "Collect labelled containers from the rear entrance.",
    containers: 2,
  });
  await session(request, "recipient", recipientId);
  transfer = await action(request, transfer, {
    action: "accept",
    revision: 1,
    pickupAt: new Date(now - 1000).toISOString(),
  });
  transfer = await action(request, transfer, { action: "receive", acceptedKg });
  await session(request, "cafe", "c-demo");
  transfer = await action(request, transfer, { action: "confirm" });
  if (usedKg !== null) {
    await session(request, "recipient", recipientId);
    transfer = await action(request, transfer, {
      action: "report_use",
      quantityKg: usedKg,
      note: "Sample recipient reports this amount used in the named treatment.",
    });
  }
  await session(request, "cafe", "c-demo");
  return { listing, transfer };
}

async function openBatch(page: Page, title: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Handovers", exact: true }).click();
  const card = page.locator(".handover-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  return card;
}

function estimateBrief(card: Locator) {
  return card.getByRole("region", { name: "Methane estimate for this batch" });
}

async function saveEstimate(page: Page, brief: Locator, transfer: Transfer) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/transfers/${transfer.id}/action`) &&
      response.request().postDataJSON()?.action === "estimate_methane",
  );
  await brief.getByRole("button", { name: "Save methane estimate" }).click();
  expect((await saved).status()).toBe(200);
}

async function openAssumptions(brief: Locator) {
  const form = brief.locator("details.methane-form");
  if (!(await form.evaluate((element) => (element as HTMLDetailsElement).open)))
    await form.locator("summary").click();
}

async function setCapture(page: Page, brief: Locator, percent: 0 | 100) {
  const slider = brief.getByRole("slider", {
    name: "Landfill gas captured (%)",
  });
  await slider.focus();
  await page.keyboard.press(percent === 0 ? "Home" : "End");
  await expect(slider).toHaveValue(String(percent));
}

const compostAssumptions = {
  disposal: "landfill",
  landfillGasCapturePercent: 0,
  destination: "compost",
  customDestinationKgCH4PerKg: null,
  destinationSource: "",
  wetMassBasis: true,
} as const;

test("saved methane assumptions use reported grounds, update the dashboard, and survive refresh", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const title = "Methane estimate — accepted and used weights differ";
  const { transfer } = await completedBatch(page.request, title);
  const card = await openBatch(page, title);
  await expect(card).toContainText("18 kg transfer confirmed");
  await expect(card).toContainText("12 kg reported used");
  const brief = estimateBrief(card);
  const save = brief.getByRole("button", { name: "Save methane estimate" });
  await expect(save).toBeDisabled();
  await brief.getByLabel("Previous disposal route").selectOption("landfill");
  await setCapture(page, brief, 0);
  await expect(save).toBeDisabled();
  await brief
    .getByRole("checkbox", {
      name: "Use the reported grounds weight as wet weight",
    })
    .check();
  await saveEstimate(page, brief, transfer);

  const data = await bootstrap(page.request);
  expect(data.transfers.find((item) => item.id === transfer.id)).toMatchObject({
    agreedKg: 20,
    acceptedKg: 18,
    reportedUseKg: 12,
    methaneAssumptions: compostAssumptions,
  });
  expect(data.recordedMethane.methaneKg).toBeCloseTo(0.891, 8);
  expect(data.recordedMethane).toMatchObject({
    estimatedTransfers: 1,
    includedReportedUseKg: 12,
  });
  await page.getByRole("button", { name: "Workspace results" }).click();
  const metrics = page.getByRole("region", {
    name: "Coffee and climate metrics",
  });
  const methane = metrics
    .locator(".metric")
    .filter({ hasText: "Estimated methane avoided" });
  await expect(methane).toContainText("0.000891");
  await expect(methane).toContainText("t CH₄");
  await expect(
    metrics.locator(".metric").filter({ hasText: "Waste reported reused" }),
  ).toContainText("12 kg");
  await page
    .getByRole("button", { name: "Network impact", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Recorded methane estimate" }),
  ).toContainText("12 kg");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Confirmed transfers" }),
  ).toContainText("18 kg");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Waste reported reused" }),
  ).toContainText("12 kg");
  await expect(
    page
      .locator(".metrics-grid .metric")
      .filter({ hasText: "Estimated methane avoided" }),
  ).toContainText("0.000891");

  await page.reload();
  await page.getByRole("button", { name: "Handovers", exact: true }).click();
  const refreshed = estimateBrief(
    page.locator(".handover-card").filter({ hasText: title }),
  );
  await openAssumptions(refreshed);
  await expect(refreshed.getByLabel("Previous disposal route")).toHaveValue(
    "landfill",
  );
  await expect(refreshed.getByLabel("Landfill gas captured (%)")).toHaveValue(
    "0",
  );
  await expect(
    refreshed.getByRole("checkbox", {
      name: "Use the reported grounds weight as wet weight",
    }),
  ).toBeChecked();
  expect((await bootstrap(page.request)).recordedMethane.methaneKg).toBeCloseTo(
    0.891,
    8,
  );
  expect(errors).toEqual([]);
});

test("existing compost earns zero incremental methane and adverse assumptions remain negative", async ({
  page,
}) => {
  const before = (await bootstrap(page.request)).recordedMethane.methaneKg ?? 0;
  const title = "Methane sensitivity — zero and negative comparisons";
  const { transfer } = await completedBatch(page.request, title);
  const brief = estimateBrief(await openBatch(page, title));
  await brief.getByLabel("Previous disposal route").selectOption("compost");
  await brief
    .getByRole("checkbox", {
      name: "Use the reported grounds weight as wet weight",
    })
    .check();
  await saveEstimate(page, brief, transfer);
  expect((await bootstrap(page.request)).recordedMethane.methaneKg).toBeCloseTo(
    before,
    8,
  );

  await openAssumptions(brief);
  await brief.getByLabel("Previous disposal route").selectOption("landfill");
  await setCapture(page, brief, 100);
  await saveEstimate(page, brief, transfer);
  const negative = await bootstrap(page.request);
  expect(negative.recordedMethane.methaneKg).toBeCloseTo(before - 0.009, 8);
  await expect(brief).toContainText(/[-−]0\.00(?:9|0009)/);

  await openAssumptions(brief);
  await brief.getByLabel("Treatment after transfer").selectOption("custom");
  await brief
    .getByLabel("Treatment methane factor (kg CH₄ per kg wet grounds)")
    .fill("0");
  await brief
    .getByLabel("Factor source or assumption")
    .fill("Test sensitivity assumption: no destination methane.");
  await saveEstimate(page, brief, transfer);
  const zero = await bootstrap(page.request);
  expect(zero.recordedMethane.methaneKg).toBeCloseTo(before, 8);
  expect(
    zero.transfers.find((item) => item.id === transfer.id)?.methaneAssumptions,
  ).toMatchObject({
    landfillGasCapturePercent: 100,
    destination: "custom",
    customDestinationKgCH4PerKg: 0,
  });
  // Replacing assumptions changes the comparison; repeated saves add no mass.
  await saveEstimate(page, brief, transfer);
  expect((await bootstrap(page.request)).recordedMethane.methaneKg).toBeCloseTo(
    before,
    8,
  );
});

test("beans, missing use reports, unrelated participants, and invalid factors cannot earn an estimate", async ({
  page,
}) => {
  const before = (await bootstrap(page.request)).recordedMethane.methaneKg;
  const beanTitle = "Methane exclusion — surplus beans remain separate";
  const beans = await completedBatch(page.request, beanTitle, {
    material: "beans",
    recipientId: "r-cafe",
    agreedKg: 5,
    acceptedKg: 5,
    usedKg: 5,
  });
  const beanResponse = await page.request.post(
    `/api/transfers/${beans.transfer.id}/action`,
    {
      data: { action: "estimate_methane", assumptions: compostAssumptions },
    },
  );
  expect(beanResponse.status()).toBe(409);
  const beanCard = await openBatch(page, beanTitle);
  await expect(
    beanCard.getByRole("button", { name: "Save methane estimate" }),
  ).toHaveCount(0);

  const noUse = await completedBatch(
    page.request,
    "Methane exclusion — no use report",
    { usedKg: null },
  );
  const noUseResponse = await page.request.post(
    `/api/transfers/${noUse.transfer.id}/action`,
    {
      data: { action: "estimate_methane", assumptions: compostAssumptions },
    },
  );
  expect(noUseResponse.status()).toBe(409);

  await session(page.request, "cafe", "c-river");
  const unrelated = await page.request.post(
    `/api/transfers/${noUse.transfer.id}/action`,
    {
      data: { action: "estimate_methane", assumptions: compostAssumptions },
    },
  );
  expect(unrelated.status()).toBe(403);
  await session(page.request, "cafe", "c-demo");
  for (const assumptions of [
    { ...compostAssumptions, landfillGasCapturePercent: 101 },
    {
      ...compostAssumptions,
      destination: "custom",
      customDestinationKgCH4PerKg: -0.01,
      destinationSource: "Invalid test factor.",
    },
  ]) {
    const invalid = await page.request.post(
      `/api/transfers/${noUse.transfer.id}/action`,
      {
        data: { action: "estimate_methane", assumptions },
      },
    );
    expect(invalid.status()).toBe(400);
  }
  const data = await bootstrap(page.request);
  expect(data.recordedMethane.methaneKg).toBe(before);
  expect(
    data.transfers.find((item) => item.id === beans.transfer.id)
      ?.methaneAssumptions ?? null,
  ).toBeNull();
  expect(
    data.transfers.find((item) => item.id === noUse.transfer.id)
      ?.methaneAssumptions ?? null,
  ).toBeNull();
});

test("mobile custom treatment requires a factor source and fits the handover without overflow", async ({
  page,
}) => {
  const title = "Mobile methane estimate — explicit custom treatment";
  const { transfer } = await completedBatch(page.request, title, {
    recipientId: "r-mushroom",
    agreedKg: 8,
    acceptedKg: 8,
    usedKg: 6,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const brief = estimateBrief(await openBatch(page, title));
  await expect(brief.getByLabel("Treatment after transfer")).toHaveValue(
    "custom",
  );
  await brief.getByLabel("Previous disposal route").selectOption("landfill");
  await brief
    .getByLabel("Treatment methane factor (kg CH₄ per kg wet grounds)")
    .fill("0.001");
  await brief
    .getByRole("checkbox", {
      name: "Use the reported grounds weight as wet weight",
    })
    .check();
  const save = brief.getByRole("button", { name: "Save methane estimate" });
  await expect(save).toBeDisabled();
  await brief
    .getByLabel("Factor source or assumption")
    .fill("Sample sensitivity assumption for mushroom treatment.");
  await expect(save).toBeEnabled();
  await brief.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (const input of await brief.locator("input, select, button").all()) {
    const box = await input.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
  }
  await saveEstimate(page, brief, transfer);
  const stored = (await bootstrap(page.request)).transfers.find(
    (item) => item.id === transfer.id,
  );
  expect(stored?.methaneAssumptions).toMatchObject({
    disposal: "landfill",
    landfillGasCapturePercent: 50,
    destination: "custom",
    customDestinationKgCH4PerKg: 0.001,
    wetMassBasis: true,
  });
});
