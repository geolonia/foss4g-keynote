/* ===================================================================
   締めスライドの 3問版 / 2問版切替（稽古用・台本の ALTERNATE CLOSE 対応）。
   2問版では問2（agent-to-agent 意味論）を隠し、問3を「2」へ振り直す。
   本番前の稽古で使わない側を決め、最終版で片方へ固定する想定。
   =================================================================== */
import { byId } from "../lib/dom";

const JA = document.documentElement.lang === "ja";

export function initCloseVariant(): void {
  const btn = byId<HTMLButtonElement>("variantToggle");
  const wrap = byId("close-questions");
  if (!btn || !wrap) return;

  const q2 = wrap.querySelector<HTMLElement>('[data-q="2"]');
  const q3no = wrap.querySelector<HTMLElement>('[data-q="3"] [data-qno]');
  let threeQ = true;

  function apply(): void {
    if (q2) q2.style.display = threeQ ? "" : "none";
    if (q3no) q3no.textContent = threeQ ? "3" : "2";
    btn!.textContent = threeQ
      ? JA ? "締め: 3問" : "Close: 3Q"
      : JA ? "締め: 2問" : "Close: 2Q";
  }

  btn.addEventListener("click", () => {
    threeQ = !threeQ;
    apply();
  });
  apply();
}
