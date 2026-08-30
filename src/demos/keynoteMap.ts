/* ===================================================================
   常駐ミニマップ（DEMO CUE ②〜④の器）。

   台本（speech/script-en.md）との対応:
   - CUE②: スライド2（title）到達で右下に出現し、以後の全スライドで常駐。
   - スライド13（payoff）の頃には「visibly full」= 投稿が育った状態を見せる。
   - CUE④: スライド14（harvest）で画面全体へ拡大する（split-screen の
     エージェント側は当日 OS レベルで併置するため、ここは地図のみ）。

   データは contributionMap.ts と同じ Contribution エンティティ
   （WS 購読 + 初期取得）。純粋変換は contributionMap.ts の
   entityToFeature / buildFeatureCollection を再利用する。
   ★数字を捏造しない: origin 未解決の投稿は描画スキップ（件数も正直に表示）。
   ★仕込み投稿（seeded=true）は別色で明示する。
   =================================================================== */
import type GeonicDB from "@geolonia/geonicdb-sdk";
import { createContributionClient } from "../lib/client";
import { byId, escapeHtml, whenIdle } from "../lib/dom";
import { onSlideChange } from "../lib/slidechange";
import { CONTRIBUTION_TYPE, buildFeatureCollection } from "./contributionMap";

const VENUE_CENTER: [number, number] = [132.4596, 34.3963];
const INSET_ZOOM = 3.4; // 302×212px の小窓で日本列島+近隣を見渡すズーム
const FULL_ZOOM = 4.6; // 全画面時

type AnyMap = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const JA = document.documentElement.lang === "ja";

export function initKeynoteMap(): void {
  const panel = byId("inset-map");
  const canvas = byId("inset-map-canvas");
  if (!panel || !canvas) return;

  const statusEl = byId("inset-status");
  let map: AnyMap = null;
  let db: GeonicDB | null = null;
  let started = false;
  let dataStarted = false;
  let fullscreen = false;
  const entities: Record<string, Record<string, unknown>> = Object.create(null);

  function setStatus(msg: string): void {
    if (statusEl) statusEl.textContent = msg;
  }

  function render(): void {
    if (!map) return;
    const list = Object.keys(entities).map((id) => entities[id]!);
    const fc = buildFeatureCollection(list);
    const skipped = list.length - fc.features.length;
    const src = map.getSource("contrib");
    if (src) src.setData(fc);
    const seededN = fc.features.filter((f) => f.properties.seeded).length;
    const realN = fc.features.length - seededN;
    setStatus(
      JA
        ? realN + " 件（+仕込み " + seededN + " 件）" + (skipped > 0 ? " ／未解決 " + skipped : "")
        : realN + " posts (+" + seededN + " seeded)" + (skipped > 0 ? " / " + skipped + " unresolved" : ""),
    );
  }

  function addLayers(): void {
    map.addSource("contrib", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "contrib-real",
      type: "circle",
      source: "contrib",
      filter: ["!=", ["get", "seeded"], true],
      paint: {
        "circle-color": "#39d6c6",
        "circle-radius": 6,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.95,
      },
    });
    map.addLayer({
      id: "contrib-seeded",
      type: "circle",
      source: "contrib",
      filter: ["==", ["get", "seeded"], true],
      paint: {
        "circle-color": "#6b7a90",
        "circle-radius": 5,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.55,
      },
    });
    const GL = window.geolonia || window.maplibregl;
    function showPopup(f: any): void {
      const p = f.properties;
      const tag = p.seeded ? (JA ? "（仕込み）" : " (seeded)") : "";
      // origin/specialty は会場からの未認証入力ゆえ、埋め込む前に必ずエスケープする。
      const html =
        "<strong>" + escapeHtml(p.origin) + tag + "</strong>" +
        (p.specialty ? "<br>" + escapeHtml(p.specialty) : "");
      new GL!.Popup({ offset: 10, closeButton: false })
        .setLngLat(f.geometry.coordinates.slice())
        .setHTML(html)
        .addTo(map);
    }
    map.on("click", "contrib-real", (ev: any) => ev.features?.[0] && showPopup(ev.features[0]));
    map.on("click", "contrib-seeded", (ev: any) => ev.features?.[0] && showPopup(ev.features[0]));
  }

  let historyFetched = false;
  function fetchHistory(): void {
    if (historyFetched) return;
    historyFetched = true;
    db!
      .getEntities({ type: CONTRIBUTION_TYPE, limit: 1000 })
      .then((res: unknown) => {
        const list: Record<string, unknown>[] = Array.isArray(res) ? res : [];
        list.forEach((e) => {
          const id = e.id as string | undefined;
          if (id) entities[id] = e;
        });
        render();
      })
      .catch((err: unknown) => {
        console.error("[keynoteMap]", err);
        setStatus(JA ? "データ取得に失敗" : "data fetch failed");
      });
  }

  function loadAndSubscribe(): void {
    if (dataStarted) return;
    dataStarted = true;
    setStatus(JA ? "読み込み中…" : "loading…");
    db!.on("entityCreated", (evt: any) => {
      const e: Record<string, unknown> | null =
        evt && evt.entity && evt.entity.id ? evt.entity : null;
      const id = e ? (e.id as string) : evt?.entityId;
      if (!id) return;
      entities[id] = e ?? { id, type: CONTRIBUTION_TYPE, ...(evt?.data ?? {}) };
      render();
    });
    db!.on("subscribed", () => fetchHistory());
    db!.subscribe({ entityTypes: [CONTRIBUTION_TYPE] });
    db!.connect().catch((err: unknown) => {
      console.warn("[keynoteMap] ws", err);
      fetchHistory(); // WS不通でも初期表示は試みる
    });
  }

  function start(): void {
    if (started) return;
    started = true;
    const GL = window.geolonia || window.maplibregl || null;
    if (!GL || typeof GL.Map !== "function") {
      setStatus(JA ? "地図ライブラリ読込失敗" : "map library failed to load");
      return;
    }
    const styleUrl = import.meta.env.BASE_URL + "assets/map-style.json";
    fetch(styleUrl)
      .then((r) => r.json())
      .then((style: any) => {
        style.sprite = location.origin + import.meta.env.BASE_URL + "assets/sprites/gsi";
        map = new GL.Map({
          container: canvas,
          style,
          center: VENUE_CENTER,
          zoom: INSET_ZOOM,
          renderWorldCopies: false,
          attributionControl: false,
        });
        map.on("load", () => {
          addLayers();
          db = createContributionClient();
          loadAndSubscribe();
        });
      })
      .catch((err: unknown) => {
        setStatus((JA ? "地図スタイル読込失敗: " : "map style failed: ") + (err instanceof Error ? err.message : String(err)));
      });
  }

  /** 右下の小窓（常駐）と全画面（CUE④）を切り替える。位置はインラインで持つ（新規CSSなし）。 */
  let currentMode: "hidden" | "inset" | "full" = "hidden";
  function setMode(mode: "hidden" | "inset" | "full"): void {
    currentMode = mode;
    if (mode === "hidden") {
      panel!.hidden = true;
      return;
    }
    panel!.hidden = false;
    const s = panel!.style;
    if (mode === "full") {
      s.left = "0"; s.top = "0"; s.right = "0"; s.bottom = "0";
      s.width = "auto"; s.height = "auto";
      s.borderRadius = "0"; s.border = "none";
      s.zIndex = "30"; // .ui (50) の下・スライドの上
    } else {
      // 小画面（スマホ横向き等）ではスライド本文を覆いすぎないよう縮小する。
      const small = window.innerWidth < 1100;
      s.left = "auto"; s.top = "auto";
      s.right = small ? "10px" : "18px";
      s.bottom = small ? "46px" : "64px";
      s.width = small ? "168px" : "302px";
      s.height = small ? "118px" : "212px";
      s.borderRadius = "12px"; s.border = "1px solid rgba(252,108,0,.45)";
      s.zIndex = "40";
    }
    if (fullscreen !== (mode === "full") && map) {
      map.setZoom(mode === "full" ? FULL_ZOOM : INSET_ZOOM);
      map.setCenter(VENUE_CENTER);
    }
    fullscreen = mode === "full";
    whenIdle(start);
    if (map) setTimeout(() => map.resize(), 60);
  }
  window.addEventListener("resize", () => setMode(currentMode));

  // data-slide スラグで自分の出番を解決する（番号のハードコードはしない）。
  const slides = Array.from(document.querySelectorAll<HTMLElement>("#deck .slide"));
  const seedIdx = slides.findIndex((s) => s.dataset.slide === "seed");
  const harvestIdx = slides.findIndex((s) => s.dataset.slide === "harvest");

  onSlideChange(({ index }) => {
    if (index === seedIdx) setMode("hidden");
    else if (index === harvestIdx) setMode("full");
    else setMode("inset");
  });
}
