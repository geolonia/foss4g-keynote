/* ===================================================================
   SLIDE 5「種明かし」（DEMO CUE ③）: 会場の実投稿 1 件の NGSI-LD JSON を
   ライブ表示する。

   - reveal スライドの 1 つ前で先読みし、到達時には表示済みにする。
   - 実投稿（seeded=false）の最新 1 件を優先。まだ無ければ仕込み投稿
     （seeded=true）へフォールバックし、タグで「仕込み」と正直に明示する
     （台本 CUE③「seeded colleague posts if the early crop is thin」と同じ扱い）。
   - 取得できない場合は HTML に書かれた静的な仕込みサンプルを残す
     （タグは「仕込みサンプル」のまま＝ライブと偽らない）。
   =================================================================== */
import { createContributionClient } from "../lib/client";
import { byId } from "../lib/dom";
import { onSlideChange } from "../lib/slidechange";
import { CONTRIBUTION_TYPE } from "./contributionMap";

const JA = document.documentElement.lang === "ja";

function attrVal(a: unknown): unknown {
  return a && typeof a === "object" && "value" in (a as Record<string, unknown>)
    ? (a as Record<string, unknown>).value
    : undefined;
}

/** 表示順（スキーマの読み上げ順）を保った 2 スペース整形 JSON を返す。 */
export function formatEntity(e: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  for (const k of ["id", "type", "origin", "specialty", "hiddenSpot", "seeded", "submittedAt"]) {
    if (k in e) ordered[k] = e[k];
  }
  for (const k of Object.keys(e)) {
    if (!(k in ordered) && k !== "@context") ordered[k] = e[k];
  }
  return JSON.stringify(ordered, null, 2);
}

/** 実投稿優先・次に仕込み、それぞれ submittedAt 降順で 1 件選ぶ。 */
export function pickLatest(list: Record<string, unknown>[]): Record<string, unknown> | null {
  const at = (e: Record<string, unknown>): string => {
    const v = attrVal(e.submittedAt);
    return typeof v === "string" ? v : "";
  };
  const sorted = [...list].sort((a, b) => (at(a) < at(b) ? 1 : -1));
  return sorted.find((e) => attrVal(e.seeded) !== true) ?? sorted[0] ?? null;
}

export function initRevealJson(): void {
  const pre = byId("reveal-json");
  const tag = byId("reveal-tag");
  if (!pre) return;

  let fetched = false;
  function load(): void {
    if (fetched) return;
    fetched = true;
    const db = createContributionClient();
    db.getEntities({ type: CONTRIBUTION_TYPE, limit: 1000 })
      .then((res: unknown) => {
        const list: Record<string, unknown>[] = Array.isArray(res) ? res : [];
        const chosen = pickLatest(list);
        if (!chosen) return; // 0件: 静的サンプル+「仕込みサンプル」タグのまま
        pre!.textContent = formatEntity(chosen);
        if (tag) {
          const seeded = attrVal(chosen.seeded) === true;
          tag.textContent = seeded
            ? JA ? "ライブ取得（仕込み投稿）" : "Live (a seeded post)"
            : JA ? "ライブ取得（会場の実投稿）" : "Live — a real post from the room";
        }
      })
      .catch((err: unknown) => {
        // 取得失敗: 静的サンプルのまま（ライブと偽らない）。
        console.warn("[revealJson]", err);
      });
  }

  const slides = Array.from(document.querySelectorAll<HTMLElement>("#deck .slide"));
  const revealIdx = slides.findIndex((s) => s.dataset.slide === "reveal");
  onSlideChange(({ index }) => {
    if (index === revealIdx - 1 || index === revealIdx) load();
  });
}
