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
import { initOriginMapPicker } from "./originMapPicker";
import { randomJitterMs } from "../lib/jitter";
import { connectWithRetry } from "../lib/connectRetry";
import { createContributionEntityRawFetch } from "../lib/rawFetchCreateEntity";

/* ControlPlane障害の根治(将軍裁定 2026-09-01): 200名が一斉に/post/を開くと、
   カウンタ/WS購読のための初回トークン引き換えがControlPlaneHandlerへ一斉
   殺到する。ページ読込直後のこの初回引き換えだけを0〜5秒のjitterで散らす
   (投稿送信時のトークン取得はcreateEntity()が必要な時にensureToken()で
   自前取得するため、このjitterの影響を受けず即座に行われる)。 */
const CONNECT_JITTER_MAX_MS = 5000;
/* ★対症療法であり根治ではない(将軍裁定 2026-09-01・PUBLIC_RATE_LIMIT.auth対応)。
   429でカウンタが永久に初期値のまま固まる沈黙no-opを潰すための安全網:
   一定時間内に一度も件数取得できなければ明示的な取得失敗文言へ落とす。
   根治(認証往復自体を減らす設計)は別途進行中。 */
const COUNT_WATCHDOG_MS = 12000;

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
    countUnavailable: "Live count unavailable",
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
    countUnavailable: "件数を取得できませんでした",
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

/** #cb-origin(地名・文字入力)を最優先で使う。空なら地図タップの座標
 *  (#cb-origin-coord)へフォールバックする——将軍指摘(PR#14是正): 地図タップが
 *  地名を上書きしてはならない(講演の山場「広島・宮城・ブルターニュから牡蠣」の
 *  ためには地名がそのまま残る必要がある)。地図だけ・文字だけどちらでも
 *  送れるようにするための役割分担(originGeo.tsのformatCoordOrigin/
 *  resolveOriginCoordsが引き続き"geo:"接頭辞を解釈する)。 */
function readInput(): ContributionInput {
  const originText = byId<HTMLInputElement>("cb-origin")?.value ?? "";
  const originCoord = byId<HTMLInputElement>("cb-origin-coord")?.value ?? "";
  return {
    origin: originText.trim() ? originText : originCoord,
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

function setCountUnavailable(lang: Lang): void {
  const el = byId("cb-count");
  if (el) el.textContent = STR[lang].countUnavailable;
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
  let countResolved = false; // db.count()が一度でも成功したか(watchdogの判定に使う)
  let countUnavailable = false; // watchdog発火後、以降resolveすれば自動的に復帰する
  function renderCount(): void {
    if (countUnavailable && !countResolved) setCountUnavailable(lang);
    else setCount(lang, lastCount);
  }
  function refreshCount(): void {
    db.count({ type: CONTRIBUTION_MODEL.type })
      .then((n) => {
        countResolved = true;
        countUnavailable = false;
        // 複数のcount()呼び出しが競合し応答が逆順で届いても、投影画面の
        // カウンタが一瞬減って見えないようにする(単調増加を保証)。
        if (n > lastCount) lastCount = n;
        renderCount();
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

    // 一定時間内に一度もdb.count()が解決しなければ、初期値のまま固まらせず
    // 明示的な取得失敗文言へ落とす(将軍裁定②・沈黙no-op対策の安全網)。
    window.setTimeout(() => {
      if (!countResolved) {
        countUnavailable = true;
        renderCount();
      }
    }, COUNT_WATCHDOG_MS);

    // db.connect()はSDKの既知の挙動として、429等の認証失敗時にPromiseを
    // rejectせず'error'を emitするだけで終わる(connectRetry.ts参照)。ゆえに
    // .catch()ではなく'error'イベント駆動の指数バックオフでリトライする。
    connectWithRetry(db, {
      onGiveUp: () => {
        console.warn("[contributionPost] connect retries exhausted");
        fetchInitialCount(); // WS不通でも初期表示だけは試みる(画面が空白のまま止まらぬよう)
      },
    });
  }, randomJitterMs(CONNECT_JITTER_MAX_MS));

  const form = byId<HTMLFormElement>("cb-form");
  const btn = byId<HTMLButtonElement>("cb-submit");
  let btnTimer = 0;
  // CodeRabbit指摘(PR#7): is-ok/is-err/disabledをclassList/disabledから逆算せず、
  // 状態を明示的に保持する。言語トグル時にどの文言(idle/sending/ok/err)を
  // 描画すべきかを、途中の状態(送信中・成功・失敗)を問わず正しく判定するため。
  let submitState: "idle" | "sending" | "ok" | "err" = "idle";
  // CodeRabbit指摘(PR#11): タイムアウト後にユーザーが再送(同じフォームで再送信)した際、
  // buildContributionEntity()が毎回新しいidを生成すると、サーバがタイムアウト前に
  // POSTを処理済み(応答だけが失われた)場合に別idのContributionとして重複登録される。
  // 直前の送信が成功していない間は同じidを使い回し、成功したら次の新規投稿のために
  // クリアする(idempotency key相当)。
  let pendingEntityId: string | null = null;
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
    const entity = buildContributionEntity(raw, {
      seeded: false,
      submittedAt: nowIso(),
      id: pendingEntityId ?? undefined,
    });
    pendingEntityId = entity.id as string;
    if (btnTimer) window.clearTimeout(btnTimer);
    submitState = "sending";
    if (btn) {
      btn.disabled = true;
      btn.classList.remove("is-ok", "is-err");
    }
    renderSubmitLabel();
    // ★SDKバイパス(将軍裁定 2026-09-01): db.createEntity()経由だとensureToken()が
    // dpopRequiredの緩和を無視し無条件で/auth/nonce往復を強制するため、投稿の
    // 送信だけはrawFetchCreateEntity.tsのX-Api-Key直付けfetchで行う(WS購読/
    // カウンタ取得は読み取り系ゆえ従来通りSDK経由のまま)。
    createContributionEntityRawFetch(entity)
      .then(() => {
        submitState = "ok";
        pendingEntityId = null;
        btn?.classList.add("is-ok");
        renderSubmitLabel();
        form.reset();
        // ★input[type=hidden]はvalue IDL属性がcontent属性へ直接reflectするため、
        // JSでel.value=...した時点でform.reset()の「初期値」自体がそこへ書き
        // 変わってしまい、reset()では戻らない(text入力とは異なる仕様・実測で
        // 判明)。座標欄は明示的にクリアする。
        const originCoordEl = byId<HTMLInputElement>("cb-origin-coord");
        if (originCoordEl) originCoordEl.value = "";
        originPicker.clearPin(); // 次の投稿が古いピンを引きずらないよう表示を初期化する
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
  // cmd_754 全面刷新(殿ご下命 2026-09-02・将軍是正 2026-09-02 19:01): 地図タップは
  // 座標専用の隠し欄(#cb-origin-coord)へ入れる。地名(#cb-origin)は上書きしない
  // ——地図が座標を、文字が地名を担う役割分担(readInput()がフォールバックを解決する)。
  const originPicker = initOriginMapPicker((coordOrigin) => {
    const el = byId<HTMLInputElement>("cb-origin-coord");
    if (el) el.value = coordOrigin;
  }, () => lang);

  const langBtn = byId<HTMLButtonElement>("cb-lang-toggle");
  langBtn?.addEventListener("click", () => {
    lang = lang === "en" ? "ja" : "en";
    langBtn.setAttribute("aria-pressed", String(lang === "ja"));
    applyStaticText(lang);
    renderCount();
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
    originPicker.refreshLang();
  });
}

initContributionPost();
