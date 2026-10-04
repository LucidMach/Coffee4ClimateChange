import { test, expect, type Page } from "@playwright/test";

// The Flask model service is mocked at the Next.js API boundary so this test
// runs without Python. ml_service/test_app.py covers the service itself.
const META = {
  options: {
    "Country.of.Origin": ["Colombia", "Ethiopia"],
    Variety: ["Caturra", "Bourbon"],
    "Processing.Method": ["Washed / Wet", "Natural / Dry"],
    Color: ["Green"],
  },
  bounds: {
    Aroma: { min: 0, max: 10 },
    Flavor: { min: 0, max: 10 },
    Aftertaste: { min: 0, max: 10 },
    Acidity: { min: 0, max: 10 },
    Body: { min: 0, max: 10 },
    Balance: { min: 0, max: 10 },
    Uniformity: { min: 0, max: 10 },
    "Clean.Cup": { min: 0, max: 10 },
    Sweetness: { min: 0, max: 10 },
    "Cupper.Points": { min: 0, max: 10 },
    Moisture: { min: 0, max: 1 },
    "Category.One.Defects": { min: 0, max: 100 },
    Quakers: { min: 0, max: 100 },
    "Category.Two.Defects": { min: 0, max: 100 },
    altitude_mean_meters: { min: 0, max: 5000 },
  },
  drivers: [
    { feature: "Flavor", importance: 0.27 },
    { feature: "Clean.Cup", importance: 0.2 },
  ],
  validation: { mae: 0.33, r2: 0.94, train_rows: 1048, test_rows: 263 },
};

async function openOverview(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
}

test("coffee quality predictor validates inputs and shows the predicted band", async ({
  page,
}) => {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/coffee-quality", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: META });
    }
    sent.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        prediction: 85.55,
        quality_category: "Exceptional",
        validation: META.validation,
        imputed: [],
        warnings: [],
      },
    });
  });

  await openOverview(page);
  const panel = page.locator("section", {
    has: page.getByRole("heading", { name: /Estimate cup quality/ }),
  });
  await expect(panel.getByText("What the model weighs most")).toBeVisible();

  await panel.getByLabel("Aroma").fill("80");
  await panel.getByRole("button", { name: "Predict coffee quality" }).click();
  await expect(panel.getByText("Use 0–10.")).toBeVisible();
  expect(sent).toHaveLength(0);

  await panel.getByLabel("Aroma").fill("8.5");
  await panel.getByLabel("Country").selectOption("Ethiopia");
  await panel.getByRole("button", { name: "Predict coffee quality" }).click();
  await expect(panel.getByText("85.55")).toBeVisible();
  await expect(panel.getByText("Exceptional", { exact: true })).toBeVisible();
  expect(sent[0]).toMatchObject({
    Aroma: 8.5,
    "Country.of.Origin": "Ethiopia",
  });

  await panel.getByLabel("Flavour").fill("");
  await expect(
    panel.getByText(/Inputs changed since this result/),
  ).toBeVisible();
});

test("coffee quality predictor explains when the model service is offline", async ({
  page,
}) => {
  await page.route("**/api/coffee-quality", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "The coffee quality service is unreachable." },
    }),
  );

  await openOverview(page);
  await expect(page.getByText(/model service isn.t responding/)).toBeVisible();
  await page.getByRole("button", { name: "Predict coffee quality" }).click();
  await expect(
    page.getByText("The coffee quality service is unreachable."),
  ).toBeVisible();
});
