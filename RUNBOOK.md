# 当日手順書（RUNBOOK）— FOSS4G Hiroshima 2026 基調講演

- 登壇: 2026-09-03（木）13:30 / 講演20分 + QA 5分
- 投影ページ: `https://geolonia.github.io/foss4g-keynote/`（英語版）/ `…/ja/`（日本語版）
- 会場投稿ページ: `…/post/`（スライド1のQRの宛先）

---

## ★★★ 当日いちばん効く二行 ★★★

> ### 1. 投稿を促す（スライド1のQR）前に、投影ページの地図接続を確立しておくこと
> ### 2. 講演中に投影ページを**絶対に再読込しない**こと

**理由**: 会場の参加者と登壇者は同じ会場Wi-Fi＝同じ公開IPを共有する。認証（WSトークン取得）は**IP単位で毎分30回**のレート制限があり、会場が投稿を始めるとこの枠は会場側で消費され尽くしうる。**一度確立したWS接続は枠を消費しない**が、**新規のトークン取得（＝再読込・初回接続）は枠に依存する**。つまり再読込した瞬間に、壇上の地図が二度と戻らない恐れがある。会場が投稿できないのは残念で済むが、壇上の地図が出ないのは講演の背骨が折れる。

**★実装上の注意（重要）**: 投影ページを**開くだけではWSは接続されない**。地図はスライド2到達時に初めて起動・接続する実装である（スライド1＝QRでは地図は隠され、初期化もされない）。ゆえに「開いておく」ではなく、下記のとおり**一度スライド2まで送って接続を確立してからスライド1へ戻す**「予熱」が必要。

---

## 開演前チェックリスト（〜13:20目安）

1. [ ] 投影端末で投影ページを開く（`/` または `/ja/`、当日使う言語の方）
2. [ ] **「→」でスライド2まで送る**。右下に地図の小窓が現れ、ステータスが「n 件（+仕込み m 件）」の件数表示になることを確認する
   - ★件数表示だけではWS接続の証にならない（WS接続に失敗しても履歴取得のフォールバックで件数は表示される実装）。**必ず次の4の生死確認まで行うこと**
   - 「読み込み中…」のまま止まる／エラー表示なら、この時点でのみ再読込してリトライしてよい（開演前なら枠は空いている）
3. [ ] **地図が空でないことを目で確かめる**（仕込み1件〔千葉県〕＋殿の実機確認分〔あれば〕が地図にピンとして見えること。空のままなら下記⑥の「最後の掃除」で消し過ぎていないか確認する）
4. [ ] **WS接続の生死を直接確認する**。ブラウザのDevToolsを開き、**必ずNetworkタブで確認する**:
   - Network タブ → 「WS」でフィルタ → WebSocket接続がステータス101で存在し、切断されていないこと（**これが唯一の確認方法**）
   - 補助情報: Console タブに `[keynoteMap] ws` の警告が出ていれば接続失敗が確定（＝履歴フォールバック表示であり、講演中の投稿が地図に反映されない）。ただし**警告が無いことは接続成功の証にならない**（警告は接続拒否時にしか出ない実装）ため、Networkタブでの101確認を省略しないこと
   - WS不通だった場合は再読込してリトライ（開演前のみ可）。確認後はDevToolsを閉じてよい
5. [ ] **「←」でスライド1（QR）へ戻す**。地図は隠れるが接続は保たれる
6. [ ] フルスクリーン化など画面まわりの操作は開演前に済ませる
7. [ ] 予備テザリング端末を使う場合（下記④参照）: 予備端末でも同じ予熱（スライド2まで送る→件数表示＋WS生死確認→スライド1へ戻す）を済ませて待機

## 講演中の掟

- **再読込しない。タブを閉じない。URLを触らない。** ブラウザのウィンドウ操作も最小限に
- 進行順序はそのままでよい: CUE①（QRで投稿誘導）→ スライド2へ送る＝CUE②（地図出現）。接続は開演前に確立済みゆえ、通常はこの順序で地図がそのまま表示される（万一出ない場合は次項のとおり）
- 万一、講演中に地図が消えた・止まった場合: **再読込で直そうとしない**。予備テザリング端末を**現在のスライドまで「→」で送ってから**投影を切り替えるか、台本の15秒フォールバック（録画デモ）へ移る（予備端末は予熱後スライド1で待機しているため、切り替えるだけでは地図は表示されない）

## ④ 予備テザリング端末（実施の要否は殿のご判断）

会場Wi-Fiとは別回線（携帯テザリング）で投影ページを開いた予備端末を用意しておく案。

- **利点**: 別回線＝別IPゆえ、会場Wi-Fiのレート枠と完全に無関係。会場側で枠が焼き尽くされても壇上は無傷。講演中の地図トラブル時の第一の逃げ道になる
- **費用・手間**: 端末1台＋テザリング回線＋投影切替（HDMI差し替え等）の準備と、開演前の予熱をもう1台分
- **切替時の注意**: 予備端末は予熱後スライド1で待機している。投影を切り替える際は、**先に予備端末を現在のスライドまで送ってから**画面を切り替えること
- **足軽所見**: 保険として有効（コード変更ゼロで最悪ケースを断ち切れる）。ただし採否のご判断は殿に委ねる

## ⑤ 投稿が弾かれた時の壇上での一言（台本外・必要になった時だけ）

会場の投稿がレート制限で弾かれると、手元の端末にはエラーが出る。ざわつきや挙手が見えたら、慌てず次の一言で流す（台本には組み込まない。言う必要が生じた時だけ）:

> 「会場の回線が混み合っているようです。投稿できなかった方は、少し時間を置いてもう一度お試しください——届いた分は、講演の最後にすべて戻ってきます」

- 英語なら: “The venue network seems busy — if your post didn’t go through, please just try again in a moment. Everything that arrives will come back at the end.”
- ポイント: 謝りすぎない・デバッグしない・「再送すればよい」と「最後に戻ってくる」の二点だけ伝えて講演へ戻る

## MCP接続(殿ご自身で登壇機にて設定・所要2分)

GeonicDBの`/mcp`エンドポイントは会場Wi-Fiの投稿レート制限(IP単位30/分)とは
**無関係な別経路**です(Bearer/APIキー認証・`/auth/nonce`を通らない・
根拠: `src/handlers/api/index.ts:729-772`)。**携帯回線テザリングは不要**、
会場Wi-Fiのままで構いません。

### ①APIキーの受け取り

1Password CLI(`op`)がこのMac miniでデスクトップアプリの承認待ちのまま
のため、暫定的にこのMac mini(足軽の作業機)のKeychainへ格納した
(service名: `geonicdb-foss4g2026-mcp-apikey-temp`)。

- 1Passwordが後で使えるようになった場合はそちらへ移す(項目名は
  「FOSS4G 2026 Keynote MCP (temp)」を予定)。
- **登壇機がこのMac miniと別機の場合、Keychainはそのままでは
  同期されない可能性がある**(iCloud Keychain同期の設定次第・
  足軽側からは確認不可)。登壇機がこのMac mini自身、またはiCloud
  Keychainで同期済みの別Macであれば、登壇機の端末で以下を実行すれば
  値が取得できる:

  ```bash
  security find-generic-password -s 'geonicdb-foss4g2026-mcp-apikey-temp' -w
  ```

  同期されていない場合の中継経路(承認手順): 家老がこのMac miniで
  `security find-generic-password -s 'geonicdb-foss4g2026-mcp-apikey-temp' -w`
  を実行して値を画面に表示し、殿が登壇機で下記を実行して**Keychainへ
  直接格納する**(`-w`を末尾に置くと対話プロンプトで入力でき、シェル
  履歴に値が残らない)。チャット・メール・ファイルへ平文で書き残さない:

  ```bash
  security add-generic-password -s 'geonicdb-foss4g2026-mcp-apikey-temp' -a "$USER" -w
  ```

APIキーの実値は、この後の手順の**コマンド引数・設定ファイルへ一切
直接書かない**(書くとプロセス一覧・シェル履歴・永続設定に残るため)。
代わりに、Keychainから読み出したヘッダーファイル(所有者のみ読める
600権限)を1つ作り、②③はそれを参照する:

```bash
# Keychain取得が失敗/空なら書き込みまで進まず「★失敗」と出る。
# 既存ファイルが緩い権限で残っていた場合に備え、作り直し+600固定
KEY="$(security find-generic-password -s 'geonicdb-foss4g2026-mcp-apikey-temp' -w)" \
  && test -n "$KEY" \
  && rm -f ~/.geonicdb-mcp-headers \
  && (umask 077; printf 'X-Api-Key: %s\nNGSILD-Tenant: foss4g_2026\n' "$KEY" > ~/.geonicdb-mcp-headers) \
  && chmod 600 ~/.geonicdb-mcp-headers \
  && ls -l ~/.geonicdb-mcp-headers \
  || echo "★失敗——①のKeychain同期/中継へ戻ること(ヘッダーファイルは書かれていない)"
unset KEY
# 成功なら最後に -rw-------(600)のファイルが1行表示される
```

### ②Claude Desktop設定

`mcp-remote`(ローカルプロキシ経由で接続)を使います。設定ファイル:
`~/Library/Application Support/Claude/claude_desktop_config.json`

既存の`mcpServers`オブジェクトの**中へ、次のメンバー1つだけを追記**する
(下記をファイル全体として貼り替えないこと——既存のサーバー設定が
消える。`"mcpServers": { ... }` の波括弧の中に、カンマ区切りで足す):

```json
"geonicdb": {
  "command": "npx",
  "args": [
    "-y",
    "mcp-remote@0.8.3",
    "https://geonicdb.geolonia.com/mcp",
    "--header-file",
    "/Users/<ユーザ名>/.geonicdb-mcp-headers"
  ]
}
```

- パスは**絶対パス**で書く(`~`はClaude Desktop経由では展開されない)。
  ターミナルで `echo "$HOME/.geonicdb-mcp-headers"` を実行し、その出力を
  そのまま貼ればよい。
- `--header-file`方式のため、この設定ファイルにAPIキーの実値は残らない
  (mcp-remote 0.8.3の`--header-file`が本番`/mcp`に対して動作することは
  2026-09-03 JST未明(=2026-09-02 15時台UTC)に実測済み。起動ログに
  `Loaded 2 header(s)`が出る)。

保存後、Claude Desktopを完全に再起動(Cmd+Q → 再度起動)してください。

### ③Claude Code設定

Desktopと同じヘッダーファイルを参照する(APIキーの実値を`claude mcp add`
の引数に渡さない——渡すと設定ファイル`~/.claude.json`とシェル履歴に
実値が保存されるため):

```bash
claude mcp add --scope user geonicdb -- npx -y mcp-remote@0.8.3 \
  https://geonicdb.geolonia.com/mcp --header-file "$HOME/.geonicdb-mcp-headers"
```

追加後、実値が保存されていないことを確認(ファイルパスだけが載る):

```bash
grep -c 'geonicdb-mcp-headers' ~/.claude.json   # 1以上ならパス参照のみでOK
```

### ④登壇機での動作確認(殿ご自身で)

**(a) curlで疎通確認(1行・すぐ結果が出ます)**:

①で作ったヘッダーファイルを`-H @ファイル`で渡す(APIキーの実値を
コマンド引数へ展開しない——引数はプロセス一覧から読めるため):

```bash
curl -sS --connect-timeout 5 --max-time 30 -w '\nHTTP %{http_code}\n' \
  https://geonicdb.geolonia.com/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H @"$HOME/.geonicdb-mcp-headers" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-03-26","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}'
```

成功条件は**2つとも**満たすこと: 末尾に `HTTP 200` が出る、かつ本文に
`"serverInfo":{"name":"GeonicDB"` が含まれる(この形そのままの成功出力を
2026-09-03 JST未明に本番へ実測済み)。どちらかが欠ける(403/429/5xx・
エラー本文・通信エラー表示・タイムアウト)なら⑥の逃げ方へ。

**(b) Claude側で確認**: Claude Desktop/Codeを開き、「geonicdbという
MCPツールで何ができるか教えて」と聞く。`entities`/`batch`/`temporal`/
`config`/`admin`の5ツールが挙がれば接続成功。実データ確認は
「Contribution型のエンティティを一覧して」等で可能(登壇直前の
最終確認にも使える)。

### ⑤当日の問い合わせ文(台本 script-en.md 212-224行に既定・変更不要)

台本CUE⑤⑥⑦でそのまま読み上げる/貼る3問(実データでの動作を
本task範囲で実証済み・2026-09-02):

1. `How many posts are there — and how many of them are our seeds?`
2. `These posts mix Japanese, English, and more. Which ones mean the same thing? Group them. Quote your evidence.`
3. `In three sentences — who is in this room?`

CUE⑧(任意・時間があれば): `Which hometown appears most often, and what is it famous for?`

### ⑥繋がらぬ時の逃げ方

- curl(④a)が403/no applicable policyを返す→ 権限設定が失効した可能性。
  家老へ直ちに連絡(swarmが数分で再設定可能な構造にしてある)。
- curlも通らずネットワーク自体が不調 → 台本のFALLBACK節
  (script-en.md 204行)のとおり、事前録画へ切り替え、MCP部分は
  「過去に実行した結果」として語る(ashigaru3が保険案を並行準備中)。
- Claudeがtools/listを返さない(接続はできたが道具が出ない)→
  Claude Desktop/Codeの再起動、またはヘッダーファイル
  (`~/.geonicdb-mcp-headers`)の中身を確認——1行に`名前: 値`の形で
  `X-Api-Key`と`NGSILD-Tenant`の2行があること(コロン後のスペースは
  有無どちらでもよい)。mcp-remoteの起動ログに`Loaded 2 header(s)`が
  出ていればファイルの読み込みは成功している。

### 登壇後(必ず実施・忘れずに)

**(1) サーバ側: APIキーとポリシーの失効**——家老/足軽が実施する
(tenant_admin/super_admin不要・foss4g_2026のuserアカウント自身の
Bearerトークン`$TOKEN`で`/me/api-keys`・`/me/policies`を叩くだけで
足りる):

```bash
# 準備: Bearerトークンもコマンド引数へ展開しない(プロセス一覧から
# 読めるため)。600権限の一時ヘッダーファイルへ書き、-H @ファイルで渡す。
# trapにより、Ctrl-C・途中失敗・シェル終了でも一時ファイルは必ず消える
REVOKE_HDR="$(mktemp)"; chmod 600 "$REVOKE_HDR"
trap 'rm -f "$REVOKE_HDR"' EXIT
printf 'Authorization: Bearer %s\nNGSILD-Tenant: foss4g_2026\n' "$TOKEN" > "$REVOKE_HDR"

# 手順0: 一覧で「実際に使った鍵」のIDを照合する。固定IDを鵜呑みに
# しない——鍵を再発行していた場合はIDが変わっており、古いIDだけ
# 消すと実際に使った鍵が生き残る
curl -sS --connect-timeout 5 --max-time 30 -w '\nHTTP %{http_code}\n' \
  https://geonicdb.geolonia.com/me/api-keys -H @"$REVOKE_HDR"
# → 本件用途(foss4g2026-keynote-mcp)に該当するkeyIdを控える。
#   発行記録(2026-09-02発行時点): keyId 4ac8b8c6-0664-428f-8f30-72ed59fca890 /
#   policyId foss4g2026-keynote-mcp-apikey-temp。一覧の実物と一致する
#   ことを確認してから次へ。

# 手順1: 失効(DELETE。または {"isActive": false} をPATCHでも可)。
# 各DELETEはHTTPステータスを検査し、2xx以外なら後続へ進まず停止する
del() {
  local code
  code=$(curl -sS --connect-timeout 5 --max-time 30 -o /dev/null -w '%{http_code}' \
    -X DELETE "$1" -H @"$REVOKE_HDR")
  echo "DELETE $1 → HTTP $code"
  case "$code" in
    2*) return 0 ;;
    *)  echo "★2xx以外——ここで停止し原因を確認(トークン期限切れ/ID誤り等)"; return 1 ;;
  esac
}
del "https://geonicdb.geolonia.com/me/api-keys/<手順0で照合したkeyId>" \
  && del "https://geonicdb.geolonia.com/me/policies/<手順0で照合したpolicyId>"

# 手順2: 事後確認(両方確認する)
#  a. /me/api-keysを再取得し、当該keyIdが消えている(またはisActive:
#     false になっている)こと
#  b. 失効させた鍵で④(a)のcurlを再実行し、HTTP 200が「返らない」こと
#     (401/403想定)

# 後始末: 一時ヘッダーファイルを削除(異常終了時はtrapが同じ削除を行う)
rm -f "$REVOKE_HDR"; trap - EXIT
```

(keyId/policyIdは秘密情報ではない・APIキー本体の値のみ機微)

**(2) 登壇機側: 鍵の痕跡の撤去**——殿ご自身または家老が実施する:

```bash
rm -f ~/.geonicdb-mcp-headers                                              # ヘッダーファイル
security delete-generic-password -s 'geonicdb-foss4g2026-mcp-apikey-temp'  # Keychain
claude mcp remove --scope user geonicdb                                    # Claude Code設定
```

- Claude Desktopは`claude_desktop_config.json`から`"geonicdb"`メンバーを
  手で削除して再起動(設定にはファイルパスしか書いていないが、登壇が
  済めば設定ごと不要のため)。
- このMac mini(足軽作業機)のKeychain格納分も同じ
  `security delete-generic-password`で削除する。

台帳・dashboard恒久🚨・9/3 18:07リマインダへの記帳は家老が対応済み
(addendum_20260903_0007参照)。

## ⑥ 本番テナント書き込みの「打ち止めの刻」と最後の掃除

本番テナントへの試験書き込みは **9/3（木）10:00 JST をもって打ち止め**とする。

- **10:00 JST 以降は、誰も本番テナントへ書き込まない**（E2Eの実投稿・手動の試験投稿とも禁止）
- **唯一の例外**: 殿ご自身による30秒の実機確認（その投稿1件は消さずに残してよい）。打ち止め後・掃除の前後いずれでもよい（下記の削除条件に合致しないため、掃除で消えることはない）

### 最後の掃除（ashigaru4 が一度だけ実施）

- **削除する対象（この条件に全て合致するものだけ）**: `type=Contribution` かつ `specialty` が `E2E-automated-test（自動テスト・削除予定）` の試験投稿
- **残すもの（対象外）**: 仕込み投稿（`seeded=true`・千葉県）と、殿の実機確認投稿（上記 specialty を持たない）——いずれも削除条件に合致しないため、条件どおりに実施すれば消えることはない
- **削除手段**: 投稿用キー（`CONTRIBUTION_KEY`）では削除が **403** になる既知制約のため、管理権限での手動削除による（これまでの試験データ削除と同じ手順・担当 ashigaru4）
- **事後確認（実測）**: 削除後に本番の実データで件数を確認し、残存が **仕込み1件（千葉県）＋殿の実機確認1件（あれば）のみ・試験投稿0件** であること
- **停止条件**: 削除がエラーになった場合、または事後確認の件数が上記と一致しない場合は、**そこで手を止め**（追加の削除・書き込みをせず）家老へ報告する
- 開演前チェックリスト3（地図が空でないことの目視確認）は、この掃除の結果が正しいことの最終確認を兼ねる

## 参考: 仕組みの要点（なぜこの手順で守れるのか）

| 事象 | レート枠（IP単位30/分）を消費するか |
|------|------|
| 投影ページを開く（スライド1のまま） | 消費しない（接続もしない＝守りにもならない） |
| スライド2へ送る（初回） | **消費する**（ここでトークン取得＝予熱はこのため） |
| 確立済みWSで投稿を受信し続ける | 消費しない |
| 投影ページの再読込 | **消費する**（会場投稿で枠が埋まっていると失敗しうる） |
| 会場の各端末が `/post/` から投稿する | 消費する（会場側の枠消費の主因） |
