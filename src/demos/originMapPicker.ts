/* ===================================================================
   cmd_754 全面刷新（2026-09-02 殿ご下命・期限9/3 08:00 JST）。
   /post/ の投稿UIに「地図から選ぶ」形を追加する（既存の文字入力フォームは
   残す・additive）。地図をタップした座標をそのまま origin へエンコードし
   （src/lib/originGeo.ts の formatCoordOrigin/resolveOriginCoords が
   同じ「器」を共有する）、ジオコーディング・新規外部APIを一切使わない。

   contributionMap.ts（会場の集計・ライブ反映用の地図）とは別の独立した
   地図インスタンス。GeonicDB SDK / WebSocket 購読を一切必要としない
   （タップした座標を読み取るだけの用途のため、認証往復・rate limit の
   対象にならない）。
   =================================================================== */
import { byId } from "../lib/dom";
import { formatCoordOrigin } from "../lib/originGeo";

const VENUE_CENTER: [number, number] = [132.4596, 34.3963];
/* ★殿ご下命(2026-09-02 22:23): 初期ズームを日本寄りの4.2から世界全体が
   見える1.5相当へ変更。地名は文字欄(#cb-origin)が担保するため、地図の
   ピンは大まかな位置で足りる——海外の参加者が縮小・移動を強いられず、
   日本の参加者も一度つまむだけで会場付近へ寄れる。 */
const PICKER_ZOOM = 1.5;
/* ★沈黙no-op対策(このリポジトリで既出6件目相当・#cb-mapのMAP_LOADING_WATCHDOG_MSに倣う):
   WebGL非対応・タブがバックグラウンドに回った等の理由で"idle"イベントが
   一度も発火しない場合、"Loading map…"に永久固定させず、文字入力欄
   (#cb-origin・常に機能する控え)へ誘導する明示的な文言へ落とす。 */
const MAP_READY_WATCHDOG_MS = 8000;

type AnyMap = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type PickerLang = "en" | "ja";

const PICKER_STR = {
  en: {
    loading: "Loading map…",
    title: "Tap the map to select where you're from",
    picked: (lat: number, lng: number) =>
      `Pinned: ${lat.toFixed(4)}, ${lng.toFixed(4)} — tap again to move`,
    libFailed: "Map unavailable — please use the text field below",
    styleFailed: "Map unavailable — please use the text field below",
    readyTimeout: "Map is taking a while — please use the text field below",
  },
  ja: {
    loading: "地図を読み込み中…",
    title: "タップして出身地を選んでください",
    picked: (lat: number, lng: number) =>
      `選択済み: ${lat.toFixed(4)}, ${lng.toFixed(4)}(タップし直すと移動できます)`,
    libFailed: "地図を読み込めませんでした。下の文字入力欄をお使いください",
    styleFailed: "地図を読み込めませんでした。下の文字入力欄をお使いください",
    readyTimeout: "地図の準備に時間がかかっています。下の文字入力欄をお使いください",
  },
} as const;

export interface OriginMapPickerApi {
  /** 言語トグル時に呼び出し側から叩く。表示中の状態文言を現在の言語で再構成する。 */
  refreshLang: () => void;
  /** 投稿成功後、ピンと状態文言を初期表示へ戻す(次の投稿が古いピンを引きずらないため)。 */
  clearPin: () => void;
}

/**
 * origin 用の地図ピッカーを初期化する。`#cb-origin-map` が無ければ安全に no-op する
 * （contributionMap.ts と同じ「器が無ければ黙って何もしない」契約に倣う・単体テスト等）。
 */
export function initOriginMapPicker(
  onPick: (coordOrigin: string) => void,
  getLang: () => PickerLang = () => "en",
): OriginMapPickerApi {
  const container = byId("cb-origin-map");
  if (!container) return { refreshLang: () => {}, clearPin: () => {} };
  const mount: HTMLElement = container;

  let GL: GeoloniaNamespace | null = null;
  let map: AnyMap = null;
  let mapDiv: HTMLDivElement | null = null;
  let marker: AnyMap = null;
  let statusSpan: HTMLElement | null = null;
  let pickedLatLng: [number, number] | null = null; // [lat, lng]（表示用・原点はlng,lat）
  // ★沈黙no-op対策: canvasが見た目に描画されてから、実際にクリックハンドラが
  // 反応可能になるまで内部的に一瞬のずれがある(maplibre-glの初期化過程・実測)。
  // このwindowでタップされても無反応(沈黙)にならぬよう、readyになるまでは
  // 「タップしてください」ではなく明示的な読み込み中の文言を出す。
  let ready = false;
  let readyTimedOut = false;
  // CodeRabbit指摘是正(PR#14): libFailed/styleFailedをsetStatus()で直書きすると、
  // refreshLang()(renderStatus()を呼ぶだけ)がこの失敗状態を知らず「Loading…」に
  // 戻ってしまう。また8秒watchdogも失敗済みかを見ずreadyTimeout文言で上書きしうる。
  // 失敗状態を変数として保持し、renderStatus()の判定に含めることで両方を防ぐ。
  let failed: "lib" | "style" | null = null;

  function setStatus(msg: string): void {
    if (statusSpan) statusSpan.textContent = msg;
  }

  function renderStatus(): void {
    const s = PICKER_STR[getLang()];
    if (failed === "lib") setStatus(s.libFailed);
    else if (failed === "style") setStatus(s.styleFailed);
    else if (pickedLatLng) setStatus(s.picked(pickedLatLng[0], pickedLatLng[1]));
    else if (ready) setStatus(s.title);
    else if (readyTimedOut) setStatus(s.readyTimeout);
    else setStatus(s.loading);
  }

  function buildDom(): void {
    if (mapDiv) return;
    statusSpan = document.createElement("div");
    statusSpan.className = "fb-chart__title";
    mount.appendChild(statusSpan);
    renderStatus();

    mapDiv = document.createElement("div");
    mapDiv.style.cssText =
      "flex:1 1 auto;min-height:260px;border-radius:8px;overflow:hidden;position:relative;margin-top:8px;";
    mount.appendChild(mapDiv);
  }

  function pinAt(lng: number, lat: number): void {
    pickedLatLng = [lat, lng];
    if (marker) {
      marker.setLngLat([lng, lat]);
    } else {
      marker = new GL!.Marker().setLngLat([lng, lat]).addTo(map);
    }
    renderStatus();
    onPick(formatCoordOrigin(lat, lng));
  }

  function start(): void {
    buildDom();
    GL = window.geolonia || window.maplibregl || null;
    if (!GL || typeof GL.Map !== "function") {
      failed = "lib";
      renderStatus();
      return;
    }
    // ★watchdogはスタイル取得(fetch)より前に仕掛ける: fetch自体が恒久ハングする
    // (ネットワーク不調・CDN障害等)場合、.then()の中に置くと登録自体がされず
    // 監視が機能しない(実際にこの順序ミスで一度テストが失敗した)。
    window.setTimeout(() => {
      // 既にlib/style失敗が確定していれば、watchdogはより具体的なその文言を
      // 汎用の「時間がかかっています」で上書きしてはならない(CodeRabbit指摘)。
      if (!ready && !failed) {
        readyTimedOut = true;
        renderStatus();
      }
    }, MAP_READY_WATCHDOG_MS);

    const styleUrl = import.meta.env.BASE_URL + "assets/map-style.json";
    fetch(styleUrl)
      .then((r) => r.json())
      .then((style: any) => {
        style.sprite = location.origin + import.meta.env.BASE_URL + "assets/sprites/gsi";
        map = new GL!.Map({
          container: mapDiv!,
          style,
          center: VENUE_CENTER,
          zoom: PICKER_ZOOM,
          renderWorldCopies: false,
        });
        map.once("idle", () => {
          ready = true;
          renderStatus();
          map.on("click", (ev: any) => pinAt(ev.lngLat.lng, ev.lngLat.lat));
        });
      })
      .catch((err: unknown) => {
        console.error("[originMapPicker]", err);
        failed = "style";
        renderStatus();
      });
  }

  start();

  function refreshLang(): void {
    renderStatus();
  }

  function clearPin(): void {
    pickedLatLng = null;
    if (marker) {
      marker.remove();
      marker = null;
    }
    renderStatus();
  }

  return { refreshLang, clearPin };
}
