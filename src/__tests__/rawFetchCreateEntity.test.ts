import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContributionEntityRawFetch, SUBMIT_TIMEOUT_MS } from "../lib/rawFetchCreateEntity";
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

  describe("timeout (CodeRabbit指摘・PR#11: 応答が返らない場合にsubmitStateが\"sending\"のまま固まらないこと)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("aborts the request and rejects once SUBMIT_TIMEOUT_MS elapses without a response", async () => {
      const fetchMock = vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const promise = createContributionEntityRawFetch({ id: "urn:test", type: "Contribution" });
      const assertion = expect(promise).rejects.toThrow(
        `Create failed: timed out after ${SUBMIT_TIMEOUT_MS}ms`,
      );

      await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      await assertion;

      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal?.aborted).toBe(true);
    });

    it("does not abort when the response arrives before the timeout", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      });
      vi.stubGlobal("fetch", fetchMock);

      await createContributionEntityRawFetch({ id: "urn:test", type: "Contribution" });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal?.aborted).toBe(false);
    });
  });
});
