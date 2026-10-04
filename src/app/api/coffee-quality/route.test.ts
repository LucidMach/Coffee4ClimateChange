import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/server", () => ({
  guardMutation: vi.fn(),
  apiError: vi.fn((error: unknown) =>
    Response.json({ error: String(error) }, { status: 400 }),
  ),
}));

const metadata = {
  model: "coffee-quality-random-forest",
  target: "Total.Cup.Points",
  validation: { mae: 0.7, r2: 0.94, train_rows: 900 },
  options: { "Country.of.Origin": ["Colombia"] },
  bounds: { Aroma: { min: 0, max: 10 } },
  drivers: [{ feature: "Aroma", importance: 0.1 }],
};
const prediction = {
  prediction: 82.15,
  quality_category: "Excellent",
  model: "coffee-quality-random-forest",
  target: "Total.Cup.Points",
  validation: { mae: 0.7, r2: 0.94 },
  imputed: ["Variety"],
  warnings: [],
};
const browserRequest = (body = JSON.stringify({ Aroma: 8 })) =>
  new Request("https://nile-judge-demo.vercel.app/api/coffee-quality", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://nile-judge-demo.vercel.app",
    },
    body,
  });

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("coffee-quality gateway response boundaries", () => {
  for (const method of ["GET", "POST"] as const) {
    const call = () =>
      method === "GET"
        ? GET(
            new Request(
              "https://nile-judge-demo.vercel.app/api/coffee-quality",
            ),
          )
        : POST(browserRequest());
    it(`${method} rejects an HTTP 200 HTML page instead of passing it to the UI`, async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("<html>Deployment protection</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );
      const response = await call();
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining("unreadable"),
      });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
    it(`${method} rejects malformed JSON returned with HTTP 200`, async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{"prediction":', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect((await call()).status).toBe(502);
    });
    it(`${method} rejects valid JSON that lacks the rendered fields`, async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ error: "Upstream response has no model payload." }),
      );
      expect((await call()).status).toBe(502);
    });
    it(`${method} preserves a valid response including additional model metadata`, async () => {
      const body = method === "GET" ? metadata : prediction;
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(body));
      const response = await call();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(body);
    });
    it(`${method} preserves an upstream validation error and its field details`, async () => {
      const body = {
        error: "Some inputs are invalid.",
        fields: { Aroma: "Must be between 0 and 10." },
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json(body, { status: 400 }),
      );
      const response = await call();
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(body);
    });
  }
  it("rejects UTF-8 bodies over 16 KiB even when they contain fewer characters", async () => {
    const raw = JSON.stringify({ note: "é".repeat(10000) });
    expect(raw.length).toBeLessThan(16 * 1024);
    expect(Buffer.byteLength(raw)).toBeGreaterThan(16 * 1024);
    const response = await POST(browserRequest(raw));
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts a request exactly at the byte limit and forwards it unchanged", async () => {
    const overhead = Buffer.byteLength(JSON.stringify({ note: "" }));
    const raw = JSON.stringify({ note: "a".repeat(16 * 1024 - overhead) });
    expect(Buffer.byteLength(raw)).toBe(16 * 1024);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(prediction));
    expect((await POST(browserRequest(raw))).status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: raw }),
    );
  });
  it("rejects non-finite prediction values serialized as null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ ...prediction, prediction: NaN }),
    );
    expect((await POST(browserRequest())).status).toBe(502);
  });
});
