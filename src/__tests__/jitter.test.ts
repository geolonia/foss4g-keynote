import { describe, expect, it } from "vitest";
import { randomJitterMs } from "../lib/jitter";

describe("randomJitterMs", () => {
  it("returns a value within [0, maxMs)", () => {
    for (let i = 0; i < 100; i++) {
      const v = randomJitterMs(5000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5000);
    }
  });

  it("returns 0 when maxMs is 0", () => {
    expect(randomJitterMs(0)).toBe(0);
  });
});
