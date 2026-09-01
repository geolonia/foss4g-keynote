/* ===================================================================
   cmd_751③ 反映画面（地図表示専用）。
   会場からの投稿（NGSI-LD エンティティ type=Contribution）を WebSocket で購読し、
   出身地（origin）を地図上へプロットする。カウンタ表示・タブ切替は
   src/demos/contribution.ts（ashigaru2 担当）側が持つため、本ファイルは地図のみを扱う。

   ★数字を捏造しない: origin が座標へ解決できない投稿は描画をスキップする
   （フォールバック座標を割り当てない）。
   ★仕込み投稿（seeded=true）は色・凡例で明示し、会場の生データと混同させない。
   =================================================================== */
import type GeonicDB from "@geolonia/geonicdb-sdk";
import { createContributionClient } from "../lib/client";
import { byId, escapeHtml, whenIdle } from "../lib/dom";
import { resolveOriginCoords } from "../lib/originGeo";
import { randomJitterMs } from "../lib/jitter";

/** cmd_751 のデータ契約（ashigaru4 subtask_751b 確定版・叩き台段階では暫定）。 */
export const CONTRIBUTION_TYPE = "Contribution";

// 会場（広島）を初期中心に。データが集まるまでは全国+海外を見渡せるズームにしておく。
const VENUE_CENTER: [number, number] = [132.4596, 34.3963];
const INITIAL_ZOOM = 4.2;
const MAP_CONNECT_JITTER_MAX_MS = 5000;

export interface ContributionFeatureProps {
  id: string;
  origin: string;
  specialty: string;
  seeded: boolean;
}
export interface ContributionFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: ContributionFeatureProps;
}
export interface ContributionFeatureCollection {
  type: "FeatureCollection";
  features: ContributionFeature[];
}

function attrVal(a: unknown): unknown {
  return a && typeof a === "object" && "value" in (a as Record<string, unknown>)
    ? (a as Record<string, unknown>).value
    : undefined;
}

/**
 * NGSI-LD の Contribution エンティティを地図描画用の GeoJSON Feature へ変換する。
 * origin を座標へ解決できない、または id を欠く場合は null（捏造せず描画から外す）。
 */
export function entityToFeature(entity: Record<string, unknown>): ContributionFeature | null {
  const id = entity.id;
  if (typeof id !== "string" || !id) return null;

  const origin = attrVal(entity.origin);
  if (typeof origin !== "string" || !origin) return null;
  const coords = resolveOriginCoords(origin);
  if (!coords) return null;

  const specialtyRaw = attrVal(entity.specialty);
  const specialty = typeof specialtyRaw === "string" ? specialtyRaw : "";

  const seededRaw = attrVal(entity.seeded);
  const seeded = seededRaw === true;

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: { id, origin, specialty, seeded },
  };
}

/** エンティティのリストを FeatureCollection へ変換する。解決不能な投稿は黙ってスキップする。 */
export function buildFeatureCollection(
  entities: Record<string, unknown>[],
): ContributionFeatureCollection {
  const features: ContributionFeature[] = [];
  for (const e of entities) {
    const f = entityToFeature(e);
    if (f) features.push(f);
  }
  return { type: "FeatureCollection", features };
}

/* ===================================================================
   ここから DOM / SDK 結線。map.ts の構成（SDK 初期化 → WS 購読 → GeoJSON 反映）に倣う。

   ★統合方式（家老確定 2026-08-28）: 独立スライドではなく、contribution.ts
   （ashigaru2）の「地図」タブ内コンテナ `#cb-map` へ自前でマウントする。
   タブの表示/非表示自体は contribution.ts 側の initTabs() が汎用的に
   面倒を見るため、本ファイルは `#cb-map` の hidden 属性を監視し、
   タブが選ばれて可視化された瞬間に地図を初期化・resize するだけでよい
   （どちらのモジュールが先に読み込まれても壊れないよう、クリックイベントの
   登録順に依存せず MutationObserver で判定する）。
   `#cb-map` が無い状態（結合前・単体テスト等）では安全に no-op する。
   =================================================================== */

type AnyMap = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type MapLang = "en" | "ja";

/* CodeRabbit指摘(PR#7): 地図タイトル・凡例・状態文言が日本語固定だと、
   英語既定の/postページで地図内部だけ日本語になる。ここでも
   contributionPost.tsと同じ「呼び出し側の言語取得関数を受け取る」方式で
   最小限に対応する(既定はja=既存の呼び出し元が無指定でも従来通りの挙動)。 */
const MAP_STR = {
  en: {
    title: "Venue Map",
    legendReal: "Venue submissions",
    legendSeeded: "Seed data (pre-loaded)",
    seededTag: " (seed)",
    loading: "Loading…",
    fetchFailed: "Failed to load data",
    libFailed: "Failed to load the map library",
    styleFailed: (msg: string) => "Failed to load map style: " + msg,
    status: (realN: number, seededN: number, skipped: number) =>
      "Showing on map: " +
      realN +
      " (+" +
      seededN +
      " seed)" +
      (skipped > 0 ? " / skipped " + skipped + " (origin unresolved)" : ""),
  },
  ja: {
    title: "会場地図",
    legendReal: "会場の投稿",
    legendSeeded: "仕込み(事前投入)",
    seededTag: "（仕込み）",
    loading: "読み込み中…",
    fetchFailed: "データ取得に失敗しました",
    libFailed: "地図ライブラリの読み込みに失敗しました",
    styleFailed: (msg: string) => "地図スタイルの読み込みに失敗: " + msg,
    status: (realN: number, seededN: number, skipped: number) =>
      "地図に表示中: " +
      realN +
      " 件（+仕込み " +
      seededN +
      " 件）" +
      (skipped > 0 ? " ／ 出身地未解決のためスキップ " + skipped + " 件" : ""),
  },
} as const;

export function initContributionMap(getLang: () => MapLang = () => "ja"): { refreshLang: () => void } {
  const container = byId("cb-map");
  if (!container) return { refreshLang: () => {} }; // 未結線ならここで終了(結合待ち)
  const mount: HTMLElement = container; // 以降のクロージャで non-null を保証する

  let GL: GeoloniaNamespace | null = null;
  let map: AnyMap = null;
  let mapDiv: HTMLDivElement | null = null;
  let db: GeonicDB | null = null;
  const entities: Record<string, Record<string, unknown>> = Object.create(null);
  let started = false;
  let dataStarted = false;
  let skipped = 0; // origin未解決で描画から外れた件数(正直に見せる)
  let statusSpan: HTMLElement | null = null;
  let titleLabelSpan: HTMLElement | null = null;
  let legendEl: HTMLElement | null = null;

  function setStatus(msg: string): void {
    if (statusSpan) statusSpan.textContent = msg;
  }

  /* CodeRabbit指摘(PR#7): refreshLang()がrenderLegend/renderのみを再実行すると、
     loading/fetchFailed/libFailed/styleFailedの各状態文言はmapが無い/データ未取得
     のままrender()が早期returnし、切替前の言語のまま取り残される。表示中の状態種別
     を保持し、切替時はその状態からstatus文言を再構成する。 */
  type MapStatusState =
    | { kind: "loading" }
    | { kind: "fetchFailed" }
    | { kind: "libFailed" }
    | { kind: "styleFailed"; msg: string }
    | { kind: "loaded" };
  let statusState: MapStatusState = { kind: "loading" };

  function renderStatus(): void {
    const s = MAP_STR[getLang()];
    switch (statusState.kind) {
      case "loading":
        setStatus(s.loading);
        break;
      case "fetchFailed":
        setStatus(s.fetchFailed);
        break;
      case "libFailed":
        setStatus(s.libFailed);
        break;
      case "styleFailed":
        setStatus(s.styleFailed(statusState.msg));
        break;
      case "loaded":
        render();
        break;
    }
  }

  function renderLegend(): void {
    if (!legendEl) return;
    const s = MAP_STR[getLang()];
    legendEl.innerHTML =
      '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#39d6c6;margin-right:4px;"></span>' +
      s.legendReal +
      '　<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#6b7a90;margin-right:4px;"></span>' +
      s.legendSeeded;
  }

  /** タブ内 DOM を組み立てる(初回のみ)。map.ts 同様のタイトル/凡例パターンに倣う。 */
  function buildDom(): void {
    if (mapDiv) return;
    const title = document.createElement("div");
    title.className = "fb-chart__title";
    titleLabelSpan = document.createElement("span");
    titleLabelSpan.textContent = MAP_STR[getLang()].title;
    statusSpan = document.createElement("span");
    statusSpan.className = "fb-chart__total";
    title.appendChild(titleLabelSpan);
    title.appendChild(statusSpan);

    legendEl = document.createElement("div");
    legendEl.className = "fb-chart__legend"; // e2e/自動テストからの安定した参照用(スタイルはinlineで別途指定)
    legendEl.style.cssText = "font-size:11px;color:rgba(255,255,255,.6);margin:2px 0 8px;";
    renderLegend();

    mapDiv = document.createElement("div");
    mapDiv.style.cssText = "flex:1 1 auto;min-height:220px;border-radius:8px;overflow:hidden;position:relative;";

    mount.appendChild(title);
    mount.appendChild(legendEl);
    mount.appendChild(mapDiv);
  }
  function render(): void {
    if (!map) return;
    const list = Object.keys(entities).map((id) => entities[id]!);
    const fc = buildFeatureCollection(list);
    skipped = list.length - fc.features.length;
    const src = map.getSource("contrib");
    if (src) src.setData(fc);
    const seededN = fc.features.filter((f) => f.properties.seeded).length;
    const realN = fc.features.length - seededN;
    statusState = { kind: "loaded" };
    setStatus(MAP_STR[getLang()].status(realN, seededN, skipped));
  }

  /** 言語トグル時に呼び出し側(contributionPost.ts)から叩く。既に描画済みの
   *  タイトル/凡例/状態文言を現在の言語へ再描画する(CodeRabbit指摘対応)。
   *  ポップアップの(仕込み)表記はクリック時にgetLang()を直接参照するため
   *  ここでの再描画は不要。 */
  function refreshLang(): void {
    if (titleLabelSpan) titleLabelSpan.textContent = MAP_STR[getLang()].title;
    renderLegend();
    renderStatus();
  }

  function addLayers(): void {
    map.addSource("contrib", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    // 実投稿（seeded=false）
    map.addLayer({
      id: "contrib-real",
      type: "circle",
      source: "contrib",
      filter: ["!=", ["get", "seeded"], true],
      paint: {
        "circle-color": "#39d6c6",
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.95,
      },
    });
    // 仕込み投稿（seeded=true）— 別色・別形状で明示し会場データと混同させない
    map.addLayer({
      id: "contrib-seeded",
      type: "circle",
      source: "contrib",
      filter: ["==", ["get", "seeded"], true],
      paint: {
        "circle-color": "#6b7a90",
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.55,
      },
    });

    function showPopup(f: any): void {
      const p = f.properties;
      const c = f.geometry.coordinates.slice();
      const tag = p.seeded ? MAP_STR[getLang()].seededTag : "";
      // origin/specialty は会場からの未認証入力ゆえ、popup HTML へ埋め込む前に必ずエスケープする。
      const html =
        "<strong>" +
        escapeHtml(p.origin) +
        tag +
        "</strong>" +
        (p.specialty ? "<br>" + escapeHtml(p.specialty) : "");
      new GL!.Popup({ offset: 10, closeButton: false }).setLngLat(c).setHTML(html).addTo(map);
    }
    map.on("click", "contrib-real", (ev: any) => ev.features?.[0] && showPopup(ev.features[0]));
    map.on("click", "contrib-seeded", (ev: any) => ev.features?.[0] && showPopup(ev.features[0]));
  }

  let historyFetched = false;
  function fetchHistory(): void {
    if (historyFetched) return; // WS失敗時のfallbackと'subscribed'の二重発火を防ぐ
    historyFetched = true;
    db!
      .getEntities({ type: CONTRIBUTION_TYPE, limit: 1000 })
      .then((res: unknown) => {
        const list: Record<string, unknown>[] = Array.isArray(res) ? res : [];
        list.forEach((e) => {
          const id = e.id as string | undefined;
          if (id) entities[id] = e; // entityCreatedと同じid上書きゆえ二重計上なし
        });
        render();
      })
      .catch((err: unknown) => {
        console.error("[contributionMap]", err);
        statusState = { kind: "fetchFailed" };
        setStatus(MAP_STR[getLang()].fetchFailed);
      });
  }

  function loadAndSubscribe(): void {
    if (dataStarted) return;
    dataStarted = true;
    statusState = { kind: "loading" };
    setStatus(MAP_STR[getLang()].loading);
    // ★先にentityCreated購読を確立してから初期取得する（取得〜購読確立の間に
    // 届いた投稿を取りこぼさぬため）。idベースの上書きゆえ二重計上はしない。
    db!.on("entityCreated", (evt: any) => {
      const e: Record<string, unknown> =
        evt && evt.entity && evt.entity.id ? evt.entity : null;
      const id = e ? (e.id as string) : evt?.entityId;
      if (!id) return;
      entities[id] = e ?? { id, type: CONTRIBUTION_TYPE, ...(evt?.data ?? {}) };
      render();
    });
    db!.on("subscribed", () => fetchHistory());
    db!.subscribe({ entityTypes: [CONTRIBUTION_TYPE] });
    db!.connect().catch((err: unknown) => {
      console.warn("[contributionMap] ws", err);
      fetchHistory(); // WS不通でも初期表示だけは試みる(画面が空白のまま止まらぬよう)
    });
  }

  function start(): void {
    if (started) return;
    started = true;
    buildDom();
    GL = window.geolonia || window.maplibregl || null;
    if (!GL || typeof GL.Map !== "function") {
      statusState = { kind: "libFailed" };
      setStatus(MAP_STR[getLang()].libFailed);
      return;
    }
    const styleUrl = import.meta.env.BASE_URL + "assets/map-style.json";
    fetch(styleUrl)
      .then((r) => r.json())
      .then((style: any) => {
        style.sprite = location.origin + import.meta.env.BASE_URL + "assets/sprites/gsi";
        map = new GL!.Map({
          container: mapDiv!,
          style,
          center: VENUE_CENTER,
          zoom: INITIAL_ZOOM,
          renderWorldCopies: false,
        });
        map.on("load", () => {
          addLayers();
          // ControlPlane障害の根治(将軍裁定 2026-09-01)・cb-map-toggleと同様、
          // 「みなさん地図を開いてください」等で開室のタイミングが重なると
          // トークン引き換えが同時多発しうるため、こちらも0〜5秒散らす。
          window.setTimeout(() => {
            db = createContributionClient();
            loadAndSubscribe();
          }, randomJitterMs(MAP_CONNECT_JITTER_MAX_MS));
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        statusState = { kind: "styleFailed", msg };
        setStatus(MAP_STR[getLang()].styleFailed(msg));
      });
  }

  /** タブが可視化された瞬間に初期化・resize する。可視判定は hidden 属性のみを見る
   *（contribution.ts の initTabs() がどちらの順で読み込まれても壊れないよう、
   *  クリックイベントの登録順に依存しない）。 */
  function onVisible(): void {
    whenIdle(start);
    if (map) setTimeout(() => map.resize(), 60);
  }
  if (!container.hidden) onVisible();
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === "hidden" && !container.hidden) onVisible();
    }
  }).observe(container, { attributes: true, attributeFilter: ["hidden"] });

  return { refreshLang };
}
