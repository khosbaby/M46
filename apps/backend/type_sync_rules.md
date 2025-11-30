# フロント型定義同期ルール

WebApp Backend で返す JSON は Next.js（`docs/apps/frontend`）の `ApiPost` や派生型にそのまま流し込む。仕様差異でバグらないよう、以下のルールを徹底する。

## 1. ソース・オブ・トゥルース
- バックエンド: `docs/apps/backend/src/modules/feed.ts` と `modules/posts.ts` で返却構造を定義。
- フロント: `docs/apps/frontend/lib/types.ts` が UI で参照する型。`normalizePost`（`lib/postTransform.ts`）が後方互換の吸収層。
- `docs/apps/backend/api_examples.md` に JSON 例があるので差分チェック時はここを更新する。

## 2. 変更フロー
1. バックエンドでフィールドを追加/削除する前に Issue / PR に「返却フィールド差分」と「用途」を明記。
2. `ApiPost` などフロント型を修正し、`normalizePost` に互換処理を追加。未使用フィールドも型定義だけは先に用意する。
3. `pnpm --filter frontend lint` を実行し、型エラーを潰す。UI 表示に影響する場合は Storybook / Playwright でスクショを撮っておく。
4. 互換性が切れる変更は `CHANGES.md`（今後追加予定）と `api_examples.md` を同時更新し、リリースノートで周知。

## 3. 命名・形式のガイドライン
- DB 行（snake_case）はバックエンドで camelCase に寄せる。例: `duration_seconds` -> `durationSeconds`。
- 日付は ISO8601 UTC 文字列。数値は常に `number` として返却し、クライアントで `Number()` せずに済むようにする。
- AI タグは `{ tag: string; trust?: number }` 配列を統一。`tags: string[]` は最大 5 件まで返却。
- `postStats` は `views/watchSeconds/bookmarks/follows/popularity` を全て含める。欠損時は `0` に揃える。
- 著者情報は `author` オブジェクトと `authorHandle/authorDisplay/authorAvatar` の両方を返し、古い UI も壊さない。

## 4. バックフィル / マイグレーションの扱い
- Supabase で列追加後は `docs/sql/schema.sql` -> `pnpm --filter codex-mcp-supabase... run generate` の順に反映し、MCP 経由の insert/update も落ちないことを確認。
- 既存レコードに欠損がある場合は `docs/scripts/seed_videos_via_mcp.mjs` を調整し、`supabase_rest.ts` で undefined を許容するロジックを追加。

## 5. テスト
- API レベル: `docs/apps/backend` で `pnpm test`（今後追加）を使うか、`curl` + `zod` でレスポンスを検証。
- フロント: `docs/tests/e2e_plan.md` に沿って Playwright / Cypress で「フィード→視聴→マイページ」動線のスナップショットを撮り、型変更の副作用を検知する。

これにより WebApp Frontend/Backend 間で同じ JSON 契約を共有し、Supabase MCP との 3 者が破綻しないよう管理する。*** End Patch
