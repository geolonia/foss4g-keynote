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
import {
  validateContribution,
  ORIGIN_MAX,
  SPECIALTY_MAX,
  HIDDEN_SPOT_MAX,
  type ContributionInput,
  type ContributionField,
} from "./contributionValidation";
import { buildContributionEntity, CONTRIBUTION_MODEL } from "./contributionEntity";
import { initContributionMap } from "./contributionMap";
import { randomJitterMs } from "../lib/jitter";

/* ControlPlane障害の根治(将軍裁定 2026-09-01): 200名が一斉に/post/を開くと、
   カウンタ/WS購読のための初回トークン引き換えがControlPlaneHandlerへ一斉
   殺到する。ページ読込直後のこの初回引き換えだけを0〜5秒のjitterで散らす
   (投稿送信時のトークン取得はcreateEntity()が必要な時にensureToken()で
   自前取得するため、このjitterの影響を受けず即座に行われる)。 */
const CONNECT_JITTER_MAX_MS = 5000;

/* ---- 言語切替(既定=英語・FOSS4G Globalは英語講演のため) ----
   contributionValidation.ts はデッキ側(contribution.ts)とも共有する
   純粋関数ゆえ、エラーメッセージの文言そのものは変更せず(日本語のまま)、
   ここでは「必須未入力か・文字数超過か」をraw入力から再判定して
   言語別メッセージを組み立てる(共有モジュールへの非互換変更を避ける)。 */
type Lang = "en" | "ja";

const STR = {
  en: {
    submitIdle: "▶ Submit",
    submitSending: "Sending…",
    submitOk: "✓ Submitted! Thank you",
    submitErr: "✗ Failed — please retry",
    mapOpen: "🗺️ Open the live map",
    mapClose: "🗺️ Close the live map",
    count: (n: number) => `${n} submissions so far`,
    err: {
      originRequired: "Please enter where you're from",
      originMax: `Please keep it within ${ORIGIN_MAX} characters`,
      specialtyRequired: "Please enter a local specialty",
      specialtyMax: `Please keep it within ${SPECIALTY_MAX} characters`,
      hiddenSpotMax: `Please keep it within ${HIDDEN_SPOT_MAX} characters`,
    },
  },
  ja: {
    submitIdle: "▶ 投稿する",
    submitSending: "送信中…",
    submitOk: "✓ 投稿しました!ありがとう",
    submitErr: "✗ 投稿に失敗 — 再度お試しください",
    mapOpen: "🗺️ 会場の地図を開く",
    mapClose: "🗺️ 地図を閉じる",
    count: (n: number) => `これまでの投稿 ${n} 件`,
    err: {
      originRequired: "出身地を入力してください",
      originMax: `出身地は${ORIGIN_MAX}文字以内で入力してください`,
      specialtyRequired: "名物を入力してください",
      specialtyMax: `名物は${SPECIALTY_MAX}文字以内で入力してください`,
      hiddenSpotMax: `隠れ名所は${HIDDEN_SPOT_MAX}文字以内で入力してください`,
    },
  },
} as const;

declare global {
  interface Window {
    /** E2E(post-page.spec.ts)がテスト投稿を削除するためだけに使う。
     *  apiKeyは元々JSバンドルに同梱されクライアント可視ゆえ、露出による
     *  セキュリティ上の追加リスクはない。 */
    __contributionDb?: ReturnType<typeof createContributionClient>;
  }
}

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

/** raw入力とvalidateContributionの結果から、フィールド毎に「必須未入力か・
 *  文字数超過か」をここで再判定し、現在の言語のメッセージを組み立てる。 */
function renderErrors(
  lang: Lang,
  raw: ContributionInput,
  errors: Partial<Record<ContributionField, string>>,
): void {
  const err = STR[lang].err;
  (["origin", "specialty", "hiddenSpot"] as ContributionField[]).forEach((field) => {
    const el = byId("cb-err-" + field);
    let msg = "";
    if (errors[field]) {
      const isEmpty = raw[field].trim().length === 0;
      if (field === "origin") msg = isEmpty ? err.originRequired : err.originMax;
      else if (field === "specialty") msg = isEmpty ? err.specialtyRequired : err.specialtyMax;
      else msg = err.hiddenSpotMax; // hiddenSpotは任意項目ゆえ空はエラーにならない
    }
    if (el) el.textContent = msg;
    const fieldInput = byId<HTMLInputElement>("cb-" + field);
    if (fieldInput) fieldInput.setAttribute("aria-invalid", errors[field] ? "true" : "false");
  });
}

/** ページ内の静的テキスト([data-en][data-ja]を持つ要素・<title>含む)を
 *  一括で現在の言語へ書き換える。動的テキスト(カウンタ・送信ボタン・地図
 *  トグル・エラー)はそれぞれの描画関数が呼び出し側で個別に再描画する。
 *  入力欄のplaceholder([data-placeholder-en][data-placeholder-ja])も
 *  ここで併せて切り替える(CodeRabbit指摘: 日本語切替後もplaceholderが
 *  英語固定のままだった)。 */
function applyStaticText(lang: Lang): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-en][data-ja]").forEach((el) => {
    const text = lang === "en" ? el.dataset.en : el.dataset.ja;
    if (text !== undefined) el.textContent = text;
  });
  document
    .querySelectorAll<HTMLInputElement>("[data-placeholder-en][data-placeholder-ja]")
    .forEach((el) => {
      const text = lang === "en" ? el.dataset.placeholderEn : el.dataset.placeholderJa;
      if (text !== undefined) el.placeholder = text;
    });
}

function setCount(lang: Lang, n: number): void {
  const el = byId("cb-count");
  if (el) el.textContent = STR[lang].count(n);
}

/** 地図トグルボタンの結線。クリックで #cb-map の hidden を外すだけ —
 *  描画自体は initContributionMap() 側の MutationObserver が担当する。 */
function initMapToggle(getLang: () => Lang): void {
  const btn = byId<HTMLButtonElement>("cb-map-toggle");
  const map = byId("cb-map");
  if (!btn || !map) return;
  btn.addEventListener("click", () => {
    const willShow = map.hidden;
    map.hidden = !willShow;
    btn.setAttribute("aria-expanded", String(willShow));
    btn.textContent = willShow ? STR[getLang()].mapClose : STR[getLang()].mapOpen;
  });
}

/** 独立投稿ページの初期化。スライド index には一切依存せず、ページ読込直後に開始する。 */
export function initContributionPost(): void {
  const db = createContributionClient();
  window.__contributionDb = db;

  // 既定は英語(FOSS4G Globalは英語講演のため)。トグルボタンで日本語へ切替可能。
  let lang: Lang = "en";
  let lastErrors: Partial<Record<ContributionField, string>> | null = null;

  let lastCount = 0;
  function refreshCount(): void {
    db.count({ type: CONTRIBUTION_MODEL.type })
      .then((n) => {
        // 複数のcount()呼び出しが競合し応答が逆順で届いても、投影画面の
        // カウンタが一瞬減って見えないようにする(単調増加を保証)。
        if (n > lastCount) {
          lastCount = n;
          setCount(lang, n);
        }
      })
      .catch((err: unknown) => console.warn("[contributionPost] count fetch failed", err));
  }

  let countFetched = false;
  function fetchInitialCount(): void {
    if (countFetched) return; // 'subscribed'とWS失敗fallbackの二重発火防止
    countFetched = true;
    refreshCount();
  }

  // ★先にentityCreated購読を確立してから初期件数を取得する('subscribed'契機)。
  // 購読確立前に作成された投稿はentityCreatedとして再送されないため、
  // 逆順(先に取得→後で購読)だと購読確立までの間の投稿を取りこぼす。
  // また件数は db.count() で取得する — db.getEntities({limit:1000}) だと
  // 1,000件超で総数が実数より少なく表示される。
  window.setTimeout(() => {
    db.on("entityCreated", () => refreshCount());
    db.on("subscribed", () => fetchInitialCount());
    db.on("error", (err) => console.warn("[contributionPost] ws", err));
    db.subscribe({ entityTypes: [CONTRIBUTION_MODEL.type] });
    db.connect().catch((err: unknown) => {
      console.warn("[contributionPost] connect failed", err);
      fetchInitialCount(); // WS不通でも初期表示だけは試みる(画面が空白のまま止まらぬよう)
    });
  }, randomJitterMs(CONNECT_JITTER_MAX_MS));

  const form = byId<HTMLFormElement>("cb-form");
  const btn = byId<HTMLButtonElement>("cb-submit");
  let btnTimer = 0;
  // CodeRabbit指摘(PR#7): is-ok/is-err/disabledをclassList/disabledから逆算せず、
  // 状態を明示的に保持する。言語トグル時にどの文言(idle/sending/ok/err)を
  // 描画すべきかを、途中の状態(送信中・成功・失敗)を問わず正しく判定するため。
  let submitState: "idle" | "sending" | "ok" | "err" = "idle";
  function renderSubmitLabel(): void {
    if (!btn) return;
    btn.textContent =
      submitState === "sending"
        ? STR[lang].submitSending
        : submitState === "ok"
          ? STR[lang].submitOk
          : submitState === "err"
            ? STR[lang].submitErr
            : STR[lang].submitIdle;
  }

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const raw = readInput();
    const result = validateContribution(raw);
    lastErrors = result.errors;
    renderErrors(lang, raw, result.errors);
    if (!result.ok) {
      // CodeRabbit指摘(PR#7): 成功/失敗直後の一時表示(is-ok/is-err・タイマー)を
      // 引きずったまま無効な値で再送信すると、バリデーションエラーと
      // 「投稿しました!」が同時に表示されてしまう。無効入力時は必ず
      // idleへ戻してから中断する。
      if (submitState === "ok" || submitState === "err") {
        if (btnTimer) window.clearTimeout(btnTimer);
        submitState = "idle";
        btn?.classList.remove("is-ok", "is-err");
        renderSubmitLabel();
      }
      return;
    }
    const entity = buildContributionEntity(raw, { seeded: false, submittedAt: nowIso() });
    if (btnTimer) window.clearTimeout(btnTimer);
    submitState = "sending";
    if (btn) {
      btn.disabled = true;
      btn.classList.remove("is-ok", "is-err");
    }
    renderSubmitLabel();
    db.createEntity(entity)
      .then(() => {
        submitState = "ok";
        btn?.classList.add("is-ok");
        renderSubmitLabel();
        form.reset();
        lastErrors = null;
        btnTimer = window.setTimeout(() => {
          submitState = "idle";
          btn?.classList.remove("is-ok");
          renderSubmitLabel();
        }, 3000);
      })
      .catch((err: unknown) => {
        console.warn("[contributionPost] create failed", err);
        submitState = "err";
        btn?.classList.add("is-err");
        renderSubmitLabel();
      })
      .finally(() => {
        if (btn) btn.disabled = false;
      });
  });

  initMapToggle(() => lang);
  const mapApi = initContributionMap(() => lang);

  const langBtn = byId<HTMLButtonElement>("cb-lang-toggle");
  langBtn?.addEventListener("click", () => {
    lang = lang === "en" ? "ja" : "en";
    langBtn.setAttribute("aria-pressed", String(lang === "ja"));
    applyStaticText(lang);
    setCount(lang, lastCount);
    renderSubmitLabel();
    const map = byId("cb-map");
    const mapToggleBtn = byId<HTMLButtonElement>("cb-map-toggle");
    if (map && mapToggleBtn) {
      mapToggleBtn.textContent = map.hidden ? STR[lang].mapOpen : STR[lang].mapClose;
    }
    if (lastErrors) {
      const raw = readInput();
      const errors = validateContribution(raw).errors;
      lastErrors = errors;
      renderErrors(lang, raw, errors);
    }
    mapApi.refreshLang();
  });
}

initContributionPost();
