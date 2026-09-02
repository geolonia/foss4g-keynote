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

/* ★殿ご下命(2026-09-02 22:23、是正 22:53): 会場中心(広島)+固定ズームでは
   スマホ縦長の細い画面で欧州・アフリカ・南北アメリカが画面外に落ちる
   （中心をずらしただけでは狙いを達しない）。地名は文字欄(#cb-origin)が
   担保するため地図のピンは大まかな位置で足りる——ゆえに投稿ページの
   初期表示に会場中心は不要（会場中心は投影側だけの役目）。
   fitBounds で世界規模の範囲へ実際に合わせ、renderWorldCopies: true で
   地図を横に繋げて行き止まりを消す。fitBounds は実コンテナの縦横比を
   見て計算するため、縦長のスマホでも横長のPCでも実際に世界が収まる。 */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -58],
  [170, 78],
];
// fitBounds が使えない場合の fallback（経度0〜90帯・中心に寄せず世界規模で開く）。
const WORLD_FALLBACK_CENTER: [number, number] = [20, 10];
const WORLD_FALLBACK_ZOOM = 0.6;
// ジオコーディング(cmd_754【4】)で地点が確定した際にflyToする先のズーム。
// 都市/地域が視認できる程度(タップ操作の精度と同程度・番地レベルは不要)。
const GEOCODE_FLY_ZOOM = 6;
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
  /**
   * 実ジオコーディング(cmd_754【4】)からの結果を反映する。地図タップと同じ
   * pinAt()を経由し座標をonPickへ渡す——「地図タップ」も「文字欄での確定
   * ジオコーディング」も同じ器(#cb-origin-coord)を後勝ちで更新する(役割
   * 分担は変えない・地名は文字欄のまま)。地図が未準備でも座標の反映だけは
   * 行う(可視化できずとも投稿には使える)。
   */
  flyToAndPin: (lat: number, lng: number) => void;
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
  if (!container) return { refreshLang: () => {}, clearPin: () => {}, flyToAndPin: () => {} };
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
    // ★ジオコーディング経由の呼び出し(flyToAndPin)は地図が未準備(loading/failed)
    // でも起こりうる——その場合でも座標の反映(onPick)だけは行い、可視化(marker)
    // だけを見送る(地図タップ由来の呼び出しは常にready後にのみ発生するため
    // map/GLは必ず存在するが、ジオコーディング由来はそうとは限らない)。
    if (map && GL) {
      if (marker) {
        marker.setLngLat([lng, lat]);
      } else {
        marker = new GL.Marker().setLngLat([lng, lat]).addTo(map);
      }
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
          center: WORLD_FALLBACK_CENTER,
          zoom: WORLD_FALLBACK_ZOOM,
          renderWorldCopies: true,
        });
        if (typeof map.fitBounds === "function") {
          map.fitBounds(WORLD_BOUNDS, { padding: 24, animate: false });
        }
        map.once("idle", () => {
          ready = true;
          renderStatus();
          map.on("click", (ev: any) => pinAt(ev.lngLat.lng, ev.lngLat.lat));
          // ★地図が未準備のうちにジオコーディング(flyToAndPin)が先に起きて
          // いた場合、当時はflyTo/markerを見送っていた(座標の反映=onPickだけは
          // 済んでいる)。ready後にその座標を可視化のみ再適用する
          // (onPickは再度呼ばない=二重反映を防ぐ・CodeRabbit指摘)。
          if (pickedLatLng) {
            const [lat, lng] = pickedLatLng;
            map.flyTo({ center: [lng, lat], zoom: GEOCODE_FLY_ZOOM, animate: false });
            if (marker) {
              marker.setLngLat([lng, lat]);
            } else if (GL) {
              marker = new GL.Marker().setLngLat([lng, lat]).addTo(map);
            }
          }
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

  function flyToAndPin(lat: number, lng: number): void {
    if (map && ready) {
      map.flyTo({ center: [lng, lat], zoom: GEOCODE_FLY_ZOOM });
    }
    // 地図が未準備でもpinAt()自体はonPick(座標反映)を必ず行う——可視化できずとも
    // 投稿には使える(originMapPickerの「地図が使えなくても文字欄で完結する」
    // 設計方針に倣う)。
    pinAt(lng, lat);
  }

  return { refreshLang, clearPin, flyToAndPin };
}
