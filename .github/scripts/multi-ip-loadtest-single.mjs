// multi-ip-loadtest.yml の各job(=各GitHub-hosted runner=別IP想定)が実行する
// 「ちょうど1リクエスト」担当スクリプト。FIRE_AT(epoch ms)まで待機してから
// 全job一斉にcreateEntity()を1回だけ叩く。単機IPのPUBLIC_RATE_LIMIT.auth
// (30/分+burst5)には各jobにつき1回しか消費しないため引っかからない。
//
// ★org GitHub Team planのActions同時実行上限=60のため、n>60では全jobを
// 文字通り同時発火できない(CodeRabbit指摘)。WAVE_SIZEごとにグループ化し、
// 各waveの発火時刻をWAVE_GAP_MS刻みでずらすことで、各wave内(≤60件)は
// 真に同時発火・wave間は前waveの完了+次waveのrunner起動を待つ現実的な
// 設計へ変更した(「200件が瞬間に同時」ではなく「60件同時のwaveが複数回」
// という正直な表現に留める)。
import { GeonicDB } from "@geolonia/geonicdb-sdk";

const ORIGIN = process.env.ORIGIN || "https://geolonia.github.io";
const _origFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => {
  const headers = new Headers(opts.headers || {});
  if (!headers.has("Origin")) headers.set("Origin", ORIGIN);
  return _origFetch(url, { ...opts, headers });
};

const TENANT = process.env.TENANT;
const API_KEY = process.env.CONTRIBUTION_KEY;
const BASE_URL = process.env.BASE_URL;
const IDX = process.env.IDX ?? "0";
const FIRE_AT = parseInt(process.env.FIRE_AT || "0", 10);
const WAVE_SIZE = parseInt(process.env.WAVE_SIZE || "60", 10);
const WAVE_GAP_MS = parseInt(process.env.WAVE_GAP_MS || "90000", 10);
const wave = Math.floor(parseInt(IDX, 10) / WAVE_SIZE);
const EFFECTIVE_FIRE_AT = FIRE_AT + wave * WAVE_GAP_MS;

async function detectSourceIp() {
  try {
    const res = await _origFetch("https://api.ipify.org?format=text");
    return (await res.text()).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  if (!API_KEY) throw new Error("CONTRIBUTION_KEY未設定(secrets.GEONICDB_CONTRIBUTION_KEYを確認せよ)");

  const sourceIp = await detectSourceIp();

  const waitMs = EFFECTIVE_FIRE_AT - Date.now();
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  if (waitMs < -5000) {
    console.log(`WARN idx=${IDX} wave=${wave} FIRE_ATを${-waitMs}ms過ぎて起動——このjobの発火は同期崩れとして除外検討`);
  }

  const client = new GeonicDB({ tenant: TENANT, apiKey: API_KEY, baseUrl: BASE_URL });
  const entity = {
    id: `urn:ngsi-ld:Contribution:loadtest-multiip-${Date.now()}-${IDX}`,
    type: "Contribution",
    origin: { type: "Property", value: "LoadTest" },
    specialty: { type: "Property", value: "loadtest" },
    seeded: { type: "Property", value: false },
    submittedAt: { type: "Property", value: new Date().toISOString() },
  };

  const t0 = Date.now();
  try {
    const res = await client.createEntity(entity);
    console.log(`RESULT idx=${IDX} wave=${wave} ok=true ms=${Date.now() - t0} ip=${sourceIp} id=${res?.id ?? entity.id}`);
  } catch (err) {
    console.log(
      `RESULT idx=${IDX} wave=${wave} ok=false ms=${Date.now() - t0} ip=${sourceIp} status=${err?.statusCode} type=${err?.constructor?.name} message=${JSON.stringify(err?.message)}`
    );
    process.exitCode = 1;
  }
}

main();
