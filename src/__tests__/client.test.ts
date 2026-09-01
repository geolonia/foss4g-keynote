import { describe, expect, it } from "vitest";
import { createContributionClient } from "../lib/client";

describe("createContributionClient", () => {
  it("returns the same instance on repeated calls (将軍裁定2026-09-01・ashigaru3発見: 訪問者ごとの認証トークン交換を2重消費させない)", () => {
    const a = createContributionClient();
    const b = createContributionClient();
    expect(a).toBe(b);
  });
});
