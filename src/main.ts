/* ===================================================================
   FOSS4G Hiroshima 2026 keynote — エントリポイント。
   livedeck の main.ts と同じ順序契約: 各ライブウィジェット（slidechange
   リスナ）を先に登録してから、デッキを起動する。この順序により
   「全ウィジェット登録済み → デッキ初回 render が slidechange を発火」
   という挙動を保つ。
   =================================================================== */
import { initKeynoteMap } from "./demos/keynoteMap";
import { initRevealJson } from "./demos/revealJson";
import { initCloseVariant } from "./demos/closeVariant";
import { initDeck } from "./deck/slides";

function boot(): void {
  initKeynoteMap();
  initRevealJson();
  initCloseVariant();
  initDeck();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
