import { describe, expect, it } from "vitest";
import { formatCoordOrigin, resolveOriginCoords } from "../lib/originGeo";

describe("resolveOriginCoords", () => {
  it("resolves a JIS 2-digit prefecture code", () => {
    // 34 = 広島県（会場）
    expect(resolveOriginCoords("34")).toEqual([132.4596, 34.3963]);
  });

  it("resolves a full Japanese prefecture name (with suffix)", () => {
    expect(resolveOriginCoords("広島県")).toEqual([132.4596, 34.3963]);
    expect(resolveOriginCoords("東京都")).toEqual([139.6917, 35.6895]);
    expect(resolveOriginCoords("北海道")).toEqual([141.3469, 43.0642]);
  });

  it("resolves a bare prefecture name without the 都道府県 suffix", () => {
    expect(resolveOriginCoords("広島")).toEqual([132.4596, 34.3963]);
  });

  it("resolves an English/romaji prefecture name case-insensitively", () => {
    expect(resolveOriginCoords("Hiroshima")).toEqual([132.4596, 34.3963]);
    expect(resolveOriginCoords("hiroshima")).toEqual([132.4596, 34.3963]);
  });

  it("resolves a known country name (Japanese or English)", () => {
    expect(resolveOriginCoords("フランス")).toEqual([2.2137, 46.2276]);
    expect(resolveOriginCoords("France")).toEqual([2.2137, 46.2276]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(resolveOriginCoords("  広島県  ")).toEqual([132.4596, 34.3963]);
  });

  it("returns null for unknown or empty input rather than guessing", () => {
    expect(resolveOriginCoords("")).toBeNull();
    expect(resolveOriginCoords("存在しない場所123")).toBeNull();
    // @ts-expect-error - runtime guard for unexpected non-string input
    expect(resolveOriginCoords(undefined)).toBeNull();
  });

  describe("「地名, 国名」形式のフォールバック(殿裁定 2026-08-31・PR#7 finding③)", () => {
    it("resolves a sub-national region not in any table by falling back to the country part", () => {
      // Bavaria単体は未収録。CodeRabbitがPR#7で指摘した地図から黙って消える投稿。
      expect(resolveOriginCoords("Bavaria, Germany")).toEqual([10.4515, 51.1657]);
    });

    it("resolves the datalist's own domestic examples (previously silently unresolved)", () => {
      // datalist自身の例示("Hiroshima, Japan"/"Kagawa, Japan")が、対応表に
      // 完全一致キーが無いために解決できていなかった既存の穴。
      expect(resolveOriginCoords("Hiroshima, Japan")).toEqual([132.4596, 34.3963]);
      expect(resolveOriginCoords("Kagawa, Japan")).toEqual([134.0475, 34.3401]);
    });

    it("falls back to the country part for an arbitrary sub-national region", () => {
      expect(resolveOriginCoords("Quebec, Canada")).toEqual([-106.3468, 56.1304]);
    });

    it("still returns null when neither part of a comma-separated input resolves", () => {
      expect(resolveOriginCoords("Timbuktu, Mali")).toBeNull();
    });
  });

  describe("地図タップで直接得た座標(cmd_754 全面刷新・formatCoordOrigin)", () => {
    it("round-trips a map-tapped coordinate through the origin string", () => {
      const encoded = formatCoordOrigin(34.3963, 132.4596);
      expect(encoded).toBe("geo:34.3963,132.4596");
      expect(resolveOriginCoords(encoded)).toEqual([132.4596, 34.3963]);
    });

    it("supports negative latitude/longitude (southern/western hemisphere)", () => {
      const encoded = formatCoordOrigin(-33.8688, 151.2093); // Sydney
      expect(resolveOriginCoords(encoded)).toEqual([151.2093, -33.8688]);
    });

    it("takes priority over the lookup table when both could theoretically apply", () => {
      // "34" 単体は都道府県コード解決の対象だが、geo: プレフィックス付きは
      // 座標エンコードとして優先的に解決される(表記が重ならないため実際には
      // 衝突しないが、優先順位の意図を明示するテスト)。
      expect(resolveOriginCoords("geo:1.0000,2.0000")).toEqual([2, 1]);
    });

    it("rejects out-of-range or malformed coordinate strings rather than guessing", () => {
      expect(resolveOriginCoords("geo:999,999")).toBeNull();
      expect(resolveOriginCoords("geo:abc,def")).toBeNull();
      expect(resolveOriginCoords("geo:34.3963")).toBeNull();
    });
  });
});
