import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodePlace } from "../lib/geocode";

describe("geocodePlace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves an arbitrary world place name via Nominatim (not limited to the 47 prefectures)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "-6.9147", lon: "107.6098", display_name: "Bandung, West Java, Indonesia" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocodePlace("Bandung");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ lat: -6.9147, lng: 107.6098, displayName: "Bandung, West Java, Indonesia" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("q=Bandung");
    expect(init.headers.Accept).toBe("application/json");
  });

  it("returns null without fabricating coordinates when nothing matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    const promise = geocodePlace("asdkjhaskjdhaskjdh");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
  });

  it("returns null (not a thrown error) on empty input", async () => {
    expect(await geocodePlace("")).toBeNull();
    expect(await geocodePlace("   ")).toBeNull();
  });

  it("returns null when the response is not ok, without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => [] }),
    );
    const promise = geocodePlace("Nairobi");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
  });

  it("returns null (not a thrown error) when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const promise = geocodePlace("São Paulo");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
  });

  it("throttles a second immediate lookup by at least ~1 second (Nominatim usage policy: max ~1 req/sec)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "1", lon: "2", display_name: "x" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = geocodePlace("Bavaria");
    await vi.runAllTimersAsync();
    await first;

    const beforeSecond = Date.now();
    const second = geocodePlace("Nairobi");
    await vi.runAllTimersAsync();
    await second;
    const elapsed = Date.now() - beforeSecond;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 2回目呼び出しの直前に1回目のfetchが完了しているため、内部のwait(1100ms)
    // がフェイクタイマーの進行として反映されているはず。
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
