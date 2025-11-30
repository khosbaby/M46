# AI タグ再評価フロー仕様

`WebApp Backend .md` で求められている「AI タグ付与（即時 / 短周期）＋モデル更新時の再評価」を運用するための手順。

## 1. データ構造
- `ai_tags` テーブル … `post_id` + `tag` + `trust`（0〜1）。1投稿につき最大10件まで保存、返却は 5 件まで。
- `post_stats` …… 人気度スコアにタグ一致度を掛け合わせる際の基礎データ。
- `app_users.save_mode / user_mute_tags` …… セーフモード時に除外対象を決める。

## 2. 即時タグ付与（リアルタイム）
1. 投稿完了 → Storage URL + メタデータを受領。
2. AI 推論ワーカー（Webhook または Supabase Functions）に `post_id` を送る。
3. モデルはタグ候補と信頼度を返す。閾値 0.4 未満はすぐ捨てる。
4. 既存タグを DELETE し、新しいタグを `trust` 降順で最大 10 件 `upsert`。
5. `post_stats.popularity` を `ai_score` と組み合わせて更新し、`feed_default()` が最新順を参照できるようにする。

## 3. 短周期タスク（例: 5 分毎）
- 直近 `updated_at > now() - interval '5 minutes'` の投稿を対象に再取得。
- 保存済みタグが 10 件未満または `trust` が急落したものを補完。
- `SAVE` モードの NG タグ一覧を Redis などにキャッシュし、レスポンス時に除外できるよう `feed.ts` から参照。

## 4. モデル更新時の再評価
1. 新モデルのリリースタグ（例: `model_v3.2`）を作成。
2. バッチワーカーが `posts` を古い `model_version` 順にスキャンし、1 ジョブあたり 200 件など上限を決めて処理。
3. 各投稿に対して:
   - 現在のタグセットと `trust` を取得。
   - 新モデルで再推論。差分が 10% 以上あれば `ai_tags_history`（要追加予定）に旧内容を保存。
   - `ai_tags` を `upsert`、`post_stats.popularity` を再計算。
   - `model_version` を更新し、ジョブが再実行されてもスキップされるようにする。
4. バッチ完了後に `/tags/recompute` API で「更新済み投稿数」を返し、監視ダッシュボードへ通知。

## 5. エラーハンドリング / 監視
- Supabase RPC（`feed_default`/`feed_by_tag`）でタグ数制限を厳守し、`trust` の NULL を返さない。
- バッチは失敗時に再実行可能な idempotent 設計。処理対象一覧を `ai_tag_jobs` キュー（`status=queued/running/done`）で管理する。
- CloudWatch / Grafana で以下を可視化:
  - タグ更新の遅延（投稿→タグ整備にかかった秒数）
  - モデル更新後に Save モードの除外件数が増減していないか
  - Supabase RPC のエラー率

## 6. フロントへの連携
- `/feed` `/feed/by-tag` は合成スコア＋タグ一致度を backend 側で決め、フロントは並び替えをしない。
- `aiTags` の上位 5 件を返しつつ、残りは `tags` として配列に含める。UI では最大 5 件即時表示、残りは展開ボタンで読ませる。
- Save モード時は `tag === 'sensitive'` などのブラックリストを持つ投稿を `hidden` 扱いにし、`FeedExperience` がマスク表示に切り替える。

これによりモデル更新時も Supabase 上のタグデータが破綻せず、MCP / API / フロントの 3 系統が同じタグ集合を扱える。*** End Patch
