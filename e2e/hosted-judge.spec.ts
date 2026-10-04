import { test, expect, type BrowserContext } from "@playwright/test";
import type { Bootstrap, Listing, ListingInput } from "../src/lib/domain";

const demoUrl = process.env.NILE_LIVE_DEMO_URL?.replace(/\/+$/, "");
const workspaceCookie = "nile-judge-workspace";

// Opt in against a deployed or locally hosted judge-mode server. The ordinary
// SQLite suite remains independent; this checks the public workspace boundary.
test.describe("hosted judge workspace", () => {
  test.skip(!demoUrl, "Set NILE_LIVE_DEMO_URL to an isolated judge-mode demo.");

  async function bootstrap(context: BrowserContext): Promise<Bootstrap> {
    const response = await context.request.get(`${demoUrl}/api/bootstrap`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const data: Bootstrap = await response.json();
    expect(data.storage).toBe("hosted-isolated-demo");
    return data;
  }

  function sampleInput(seed: Listing, title: string): ListingInput {
    const now = Date.now();
    return {
      ...seed,
      title,
      quantityKg: 13.5,
      collectedAt: new Date(now - 3600000).toISOString(),
      availableAt: new Date(now - 60000).toISOString(),
      expiresAt: new Date(now + 6 * 3600000).toISOString(),
      notes: "Fictional hosted verification batch; no real transfer or impact.",
    };
  }

  test("first SSR binds private data; refresh, other browsers and tampered capabilities preserve isolation", async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const origin = new URL(demoUrl!).origin;
    const first = await browser.newContext({ baseURL: demoUrl });
    const second = await browser.newContext({ baseURL: demoUrl });
    const tampered = await browser.newContext({ baseURL: demoUrl });
    try {
      const page = await first.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const home = await page.goto("/");
      expect(home?.status()).toBe(200);
      expect(home?.headers()["cache-control"]).toContain("no-store");
      await expect(page.getByText("JUDGE DEMO", { exact: true })).toBeVisible();
      await expect(page.locator("footer")).toContainText(
        "Sample businesses & offers",
      );

      const cookie = (await first.cookies()).find(
        (item) => item.name === workspaceCookie,
      );
      expect(cookie).toBeDefined();
      expect(cookie!.httpOnly).toBe(true);
      expect(cookie!.sameSite).toBe("Lax");
      expect(cookie!.secure).toBe(origin.startsWith("https:"));

      const initial = await bootstrap(first);
      expect(initial.ai.configured).toBe(false);
      const seed = initial.listings.find(
        (listing) => listing.material === "grounds",
      );
      expect(seed).toBeDefined();
      const title = `Hosted sample verification ${Date.now()}`;
      const input = sampleInput(seed!, title);
      const saved = await first.request.post(`${demoUrl}/api/listings`, {
        headers: { Origin: origin },
        data: input,
      });
      expect(saved.status()).toBe(201);
      const { listing }: { listing: Listing } = await saved.json();
      expect((await bootstrap(first)).listings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: listing.id, title }),
        ]),
      );
      const refreshed = await page.reload();
      expect(await refreshed!.text()).toContain(title);
      await page
        .getByRole("button", { name: "My materials", exact: true })
        .click();
      await expect(
        page.locator(".listing-row").filter({ hasText: title }),
      ).toContainText("13.5");

      const otherPage = await second.newPage();
      const otherHome = await otherPage.goto("/");
      expect(otherHome?.status()).toBe(200);
      expect(await otherHome!.text()).not.toContain(title);
      const otherCookie = (await second.cookies()).find(
        (item) => item.name === workspaceCookie,
      );
      expect(otherCookie!.value).not.toBe(cookie!.value);
      expect(
        (await bootstrap(second)).listings.some(
          (item) => item.id === listing.id,
        ),
      ).toBe(false);
      expect(
        (
          await second.request.get(
            `${demoUrl}/api/listings/${listing.id}/matches`,
          )
        ).status(),
      ).toBe(404);

      // Even a valid token supplied as an untrusted header cannot select A's data.
      const forgedHeader = await second.request.get(
        `${demoUrl}/api/bootstrap`,
        {
          headers: { "x-nile-judge-workspace": cookie!.value },
        },
      );
      expect(forgedHeader.status()).toBe(200);
      const forgedData: Bootstrap = await forgedHeader.json();
      expect(forgedData.listings.some((item) => item.id === listing.id)).toBe(
        false,
      );

      for (const badOrigin of ["https://untrusted.example", ""]) {
        const blocked = await first.request.post(`${demoUrl}/api/listings`, {
          headers: { Origin: badOrigin },
          data: { ...input, title: "Blocked cross-origin sample" },
        });
        expect(blocked.status()).toBe(403);
      }
      expect(
        (await bootstrap(first)).listings.some(
          (item) => item.title === "Blocked cross-origin sample",
        ),
      ).toBe(false);

      const altered =
        cookie!.value.slice(0, -1) + (cookie!.value.at(-1) === "a" ? "b" : "a");
      await tampered.addCookies([{ ...cookie!, value: altered }]);
      const tamperedPage = await tampered.newPage();
      const tamperedHome = await tamperedPage.goto("/");
      expect(tamperedHome?.status()).toBe(200);
      expect(await tamperedHome!.text()).not.toContain(title);
      const replacement = (await tampered.cookies()).find(
        (item) => item.name === workspaceCookie,
      );
      expect(replacement!.value.split(".")[0]).not.toBe(
        cookie!.value.split(".")[0],
      );
      expect(
        (
          await tampered.request.get(
            `${demoUrl}/api/listings/${listing.id}/matches`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (await bootstrap(first)).listings.some(
          (item) => item.id === listing.id,
        ),
      ).toBe(true);
      expect(pageErrors).toEqual([]);
    } finally {
      await Promise.all([first.close(), second.close(), tampered.close()]);
    }
  });
});
