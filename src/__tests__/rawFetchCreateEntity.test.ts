import { afterEach, describe, expect, it, vi } from "vitest";
import { createContributionEntityRawFetch } from "../lib/rawFetchCreateEntity";
import { contributionConnConfig } from "../lib/config";

describe("createContributionEntityRawFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs directly with an X-Api-Key header, bypassing the SDK's ensureToken() token exchange (将軍裁定2026-09-01)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createContributionEntityRawFetch({ id: "urn:test", type: "Contribution" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${contributionConnConfig.baseUrl}/ngsi-ld/v1/entities`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Api-Key"]).toBe(contributionConnConfig.key);
    expect(init.headers["Content-Type"]).toBe("application/ld+json");
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ id: "urn:test", type: "Contribution" });
  });

  it("surfaces the server-provided detail message when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "missing origin" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createContributionEntityRawFetch({ id: "urn:test", type: "Contribution" }),
    ).rejects.toThrow("Create failed (400): missing origin");
  });

  it("falls back to statusText when the error body has neither detail nor description", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createContributionEntityRawFetch({ id: "urn:test", type: "Contribution" }),
    ).rejects.toThrow("Create failed (500): Internal Server Error");
  });
});
