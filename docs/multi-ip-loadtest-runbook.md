# multi-ip-loadtest 実行手順書(subtask_751h)

将軍の最終GOが出た瞬間に迷わず動けるよう、事前に手順を固定しておく。
本番テナント`foss4g_2026`(tenantId=`6cd51668-6876-40f5-8210-a629c40331e8`)へ
実際に負荷をかける試験である。**GOが出るまでworkflow_dispatchは実行しない**。

## 前提条件(実行前に全て確認)

- [ ] 将軍の最終GOが出ている(dashboard.md 🚨または家老inbox指示で明示)
- [ ] `.github/workflows/multi-ip-loadtest.yml`が`main`へmerge済み(このPR#10)
- [ ] ashigaru2のSDKバイパス実装(contributionPost.tsが`/auth/nonce`往復を
      経由せず`X-Api-Key`直接POSTする改修)がmerge・deploy済み——★これが
      入っていない場合、この試験は「サーバ側は直接POSTを許すが実際の
      デモ経路はまだSDK経由のtoken交換を行っている」状態を測るだけになり
      意味をなさない(subtask_751h報告⑦の(ii)参照)
- [ ] `dpopRequired=false`が`CONTRIBUTION_KEY`(foss4g-2026-keynote-
      contribution)に反映されたまま(PATCH済み・元に戻していない)
- [ ] 本番`PUBLIC_RATE_LIMIT.auth`のrate limitが解除されている
      (17:00 JST解除見込み・`curl -I .../oauth/token`等で429が
      出ないことを事前に軽く確認してもよいが、本番トークンを浪費する
      重い確認は避ける)
- [ ] `gh auth status`で`geolonia/foss4g-keynote`への書き込み権限を確認

## 実行手順

1. mainの最新化を確認:
   ```bash
   cd /Users/hal/workspace/foss4g-keynote  # または任意のclean worktree
   git fetch origin main && git log -1 origin/main
   ```

2. 発火時刻を「今から8分後」に指定してdispatch。`gh run list -L1`は
   dispatchとの対応を保証しない(他の実行と取り違える危険)ため、
   `gh workflow run`が返すrun URLからRUN_IDを直接取得する
   (CodeRabbit指摘・gh CLI 2.87.0以降で対応。古いCLIでURLが返らない
   場合はevent/branch/actor/時刻で一意特定するフォールバックを使う):
   ```bash
   unset GH_TOKEN
   FIRE_AT=$(( $(date +%s%3N) + 480000 ))
   DISPATCH_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
   RUN_URL=$(gh workflow run multi-ip-loadtest.yml -R geolonia/foss4g-keynote --ref main \
     -f n=200 -f fire_at_epoch_ms=$FIRE_AT)
   if [ -n "$RUN_URL" ]; then
     RUN_ID="${RUN_URL##*/}"
   else
     sleep 3
     RUN_ID=$(gh run list -R geolonia/foss4g-keynote --workflow=multi-ip-loadtest.yml \
       --json databaseId,event,headBranch,createdAt \
       -q "[.[] | select(.event==\"workflow_dispatch\" and .headBranch==\"main\" and .createdAt>=\"$DISPATCH_AT\")] | sort_by(.createdAt) | .[0].databaseId")
   fi
   echo "FIRE_AT=$FIRE_AT ($(date -r $((FIRE_AT/1000)) 2>/dev/null || date -d @$((FIRE_AT/1000)))) RUN_ID=$RUN_ID"
   ```
   - `n`は既定200(1〜200の範囲でバリデーションされる)。
   - waveは60件単位(`WAVE_SIZE=60`)、wave間は90秒(`WAVE_GAP_MS`)ずつ
     ずれる。200件なら4wave目の発火はdispatchから約8分+90秒×3=12.5分後。

3. 実行状況を監視:
   ```bash
   gh run watch "$RUN_ID" -R geolonia/foss4g-keynote
   ```

4. 完了後、`verify-ip-diversity` jobのログでIP多様性検証結果を確認:
   ```bash
   gh run view "$RUN_ID" -R geolonia/foss4g-keynote --log | grep -A5 "verify-ip-diversity"
   ```
   `total_results`が指定した`n`と一致していること(RESULT出力前に落ちた
   job=欠落がないこと)、`ok_true+ok_false`も`n`と一致していること、かつ
   `unique_source_ips`が`total_results`と一致していることを確認する
   (workflow自体がこれらをexit 1で強制するが、ログでも目視確認する。
   一致しなければ試験前提が崩れている=結果を鵜呑みにしない)。

5. 各jobのRESULTログ(OK/NG・latency・wave・ip)を収集して成功率を集計:
   ```bash
   gh run view "$RUN_ID" -R geolonia/foss4g-keynote --log | grep '^.*RESULT ' > /tmp/loadtest-results.log
   grep -c 'ok=true' /tmp/loadtest-results.log
   grep -c 'ok=false' /tmp/loadtest-results.log
   ```

## 試験後の後始末(必須)

1. tenant_admin資格情報(Keychain: `geonicdb-foss4g2026-tenant-admin-email`
   / `-password`)でログインし、`urn:ngsi-ld:Contribution:loadtest-*`
   接頭辞のentityを全件削除する(公開デモ画面への汚染防止)。
2. 削除後、`GET /ngsi-ld/v1/entities?type=Contribution&idPattern=^urn:ngsi-ld:Contribution:loadtest-multiip-`
   で残0件を実測確認する(`q`は属性値検索用でありIDの正規表現検索には
   使えない——CodeRabbit指摘。idPatternを使うこと)。
3. 試験結果(成功率・latency分布・IP多様性)をqueue/reports/
   ashigaru1_report.yamlへ追記し家老へ報告する。

## 異常時の中断

- 実行中に中断が必要な場合:
  ```bash
  gh run cancel "$RUN_ID" -R geolonia/foss4g-keynote
  ```
- 中断してもfireジョブが既に投げたリクエストは取り消せない
  (createEntity済みのものは上記の後始末手順で削除する)。

## 復旧(登壇後・必須)

- `dpopRequired`を`CONTRIBUTION_KEY`について`false`→`true`へ戻す
  (または鍵自体を破棄・再発行する)。これは将軍裁定
  (addendum_20260901_1634_dpop_relax_approved)の恒久条件③であり、
  9/3登壇完了報告と同時に家老が必須タスクとしてdispatchする運びに
  なっている——本runbookの実行者は復旧タスクの発火有無も合わせて確認する。
