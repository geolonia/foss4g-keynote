/* ===================================================================
   FOSS4G Hiroshima 2026 独立投稿ページ（/post/）。
   デッキ本体（スライド遷移・タブ・集計チャート）に依存しない最小構成。
   来場者がQRから直接開くスマホ専用ページ。バリデーション・エンティティ
   構築ロジックは contribution.ts（旧 geonicdb-livedeck 実装）と同一の
   contributionValidation.ts / contributionEntity.ts をそのまま再利用する。
   地図（contributionMap.ts）も「#cb-map の hidden 監視で初期化する」既存の
   契約をそのまま再利用する — #cb-map の器はこのページの index.html に
   最初から存在し、トグルボタンで hidden を外すことで実描画へつながる
   （2026-08-30 殿ご指摘: 器だけあって描画されない沈黙no-opを繰り返さない）。
   =================================================================== */
import { createContributionClient } from "../lib/client";
import { byId } from "../lib/dom";
import { validateContribution, type ContributionInput, type ContributionField } from "./contributionValidation";
import { buildContributionEntity, CONTRIBUTION_MODEL } from "./contributionEntity";
import { initContributionMap } from "./contributionMap";

function nowIso(): string {
  return new Date().toISOString();
}

function readInput(): ContributionInput {
  return {
    origin: byId<HTMLInputElement>("cb-origin")?.value ?? "",
    specialty: byId<HTMLInputElement>("cb-specialty")?.value ?? "",
    hiddenSpot: byId<HTMLInputElement>("cb-hiddenSpot")?.value ?? "",
  };
}

function renderErrors(errors: Partial<Record<ContributionField, string>>): void {
  (["origin", "specialty", "hiddenSpot"] as ContributionField[]).forEach((field) => {
    const el = byId("cb-err-" + field);
    if (el) el.textContent = errors[field] ?? "";
    const fieldInput = byId<HTMLInputElement>("cb-" + field);
    if (fieldInput) fieldInput.setAttribute("aria-invalid", errors[field] ? "true" : "false");
  });
}

function setCount(n: number): void {
  const el = byId("cb-count");
  if (el) el.textContent = "これまでの投稿 " + n + " 件 / " + n + " submissions so far";
}

/** 地図トグルボタンの結線。クリックで #cb-map の hidden を外すだけ —
 *  描画自体は initContributionMap() 側の MutationObserver が担当する。 */
function initMapToggle(): void {
  const btn = byId<HTMLButtonElement>("cb-map-toggle");
  const map = byId("cb-map");
  if (!btn || !map) return;
  btn.addEventListener("click", () => {
    const willShow = map.hidden;
    map.hidden = !willShow;
    btn.setAttribute("aria-expanded", String(willShow));
    btn.textContent = willShow
      ? "🗺️ 地図を閉じる / Close the live map"
      : "🗺️ 会場の地図を開く / Open the live map";
  });
}

/** 独立投稿ページの初期化。スライド index には一切依存せず、ページ読込直後に開始する。 */
export function initContributionPost(): void {
  const db = createContributionClient();
  let count = 0;
  const seen: Record<string, true> = Object.create(null);

  function bumpCount(id: string | undefined): void {
    if (!id || seen[id]) return;
    seen[id] = true;
    count += 1;
    setCount(count);
  }

  db.getEntities({ type: CONTRIBUTION_MODEL.type, limit: 1000 })
    .then((res) => {
      const list = Array.isArray(res) ? res : [];
      list.forEach((e) => bumpCount((e as Record<string, unknown>).id as string | undefined));
    })
    .catch((err: unknown) => console.warn("[contributionPost] initial count fetch failed", err));

  db.on("entityCreated", (evt) => {
    const e = evt as unknown as { entityId?: string; entity?: { id?: string } };
    bumpCount(e.entity?.id ?? e.entityId);
  });
  db.on("error", (err) => console.warn("[contributionPost] ws", err));
  db.subscribe({ entityTypes: [CONTRIBUTION_MODEL.type] });
  db.connect().catch((err: unknown) => console.warn("[contributionPost] connect failed", err));

  const form = byId<HTMLFormElement>("cb-form");
  const btn = byId<HTMLButtonElement>("cb-submit");
  const SUBMIT_LABEL = btn?.textContent ?? "▶ 投稿する / Submit";
  let btnTimer = 0;

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const raw = readInput();
    const result = validateContribution(raw);
    renderErrors(result.errors);
    if (!result.ok) return;
    const entity = buildContributionEntity(raw, { seeded: false, submittedAt: nowIso() });
    if (btnTimer) window.clearTimeout(btnTimer);
    if (btn) {
      btn.disabled = true;
      btn.classList.remove("is-ok", "is-err");
      btn.textContent = "送信中… / Sending…";
    }
    db.createEntity(entity)
      .then(() => {
        if (btn) {
          btn.classList.add("is-ok");
          btn.textContent = "✓ 投稿しました！ありがとう / Submitted! Thank you";
        }
        form.reset();
        btnTimer = window.setTimeout(() => {
          if (btn) {
            btn.classList.remove("is-ok");
            btn.textContent = SUBMIT_LABEL;
          }
        }, 3000);
      })
      .catch((err: unknown) => {
        console.warn("[contributionPost] create failed", err);
        if (btn) {
          btn.classList.add("is-err");
          btn.textContent = "✗ 投稿に失敗 / Failed — please retry";
        }
      })
      .finally(() => {
        if (btn) btn.disabled = false;
      });
  });

  initMapToggle();
  initContributionMap();
}

initContributionPost();
