# パスキー認証・投稿・プロフィール 手動確認手順

ローカル構成: Backend `http://localhost:3001`, Frontend `http://localhost:3000`

## 前提準備
1. `apps/backend/.env` に `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `PORT=3001` / `FRONTEND_ORIGIN=` を設定。
2. `apps/frontend/.env.local` に `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` などを設定。
3. Supabase 側で `app_users` に `display_name` カラム、および `posts.owner_id` などが正しく紐づくことを確認。

## 1. パスキーサインアップ → フィード表示
1. `pnpm dev:backend` を起動。
2. 別ターミナルで `pnpm dev:frontend` を起動。
3. ブラウザで `http://localhost:3000` を開く。
4. AuthGateway の「パスキーでサインイン」カードで「サインアップ」を押し、ハンドル/メールを入力。
5. ブラウザのパスキーダイアログで登録を許可 → 成功すると自動でフィードが表示される。
6. Supabase Table Editor で `app_users` に新規レコードができ、`display_name`, `created_at` が埋まっていることを確認。

## 2. パスキーでの再ログイン
1. 一度ブラウザを閉じる（または `localStorage` の `m46_session_token` を削除）。
2. `http://localhost:3000` を開き直し、「パスキーでログイン」から登録済みパスキーを選択する。
3. フィードが表示され、ヘッダにログイン状態のアクション（投稿・プロフィールリンク）が表示される。

## 3. 投稿作成・プロフィール編集
1. ログイン状態で Home に表示される「投稿コンソールを開く」を押し、 `/post` へ遷移。
2. Storage URL, タイトルなどを入力し投稿。Fastify `/posts` が 200 を返し、Supabase `posts` に `owner_id` がログインユーザー ID で保存されることを Table Editor で確認。
3. `/mypage` へ移動し、表示名やタグラインを編集→保存。`creator_profiles` / `app_users.display_name` に反映されることを確認。

## 4. 必要に応じた E2E テスト
Playwright などを導入する場合は `pnpm create playwright` 等でセットアップし、上記 1〜3 を自動化する。現状は手動確認で十分なため、スクリプト追加は任意。
