# WebApp API 例一覧

`WebApp Backend .md` で列挙されている REST API を Supabase 本番環境向けに固定したリクエスト／レスポンス例。全て `Content-Type: application/json`、WebAuthn セッションは `Authorization: Bearer <session token>` を付与する。

## 認証 / セッション

### POST `/auth/webauthn/register/start`
ユーザー登録時に Passkey ceremony を開始する。

**Request**
```json
{
  "handle": "@cityglow",
  "displayName": "City Glow",
  "challengeTtlSeconds": 120
}
```

**Response**
```json
{
  "challenge": "C0X9...I33o",
  "rp": { "name": "M46 Short-Form Video SNS", "id": "m46.org" },
  "user": { "id": "a860...", "name": "@cityglow", "displayName": "City Glow" },
  "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }]
}
```

### POST `/auth/webauthn/register/finish`

**Request**
```json
{
  "challengeId": "C0X9...I33o",
  "credential": {
    "id": "BKeA...",
    "rawId": "BKeA...",
    "response": {
      "clientDataJSON": "eyJ0eXAiOi...",
      "attestationObject": "o2NmbXRjdH..."
    },
    "type": "public-key",
    "clientExtensionResults": {}
  }
}
```

**Response**
```json
{
  "session": {
    "token": "sess_7ad5...",
    "userId": "0dbf...",
    "expiresAt": "2024-08-25T11:02:00.000Z"
  }
}
```

### POST `/auth/webauthn/login/start`
```json
{ "handle": "@cityglow" }
```
レスポンスは `publicKey` チャレンジ。`allowCredentials` に登録済み credentialId が入る。

### POST `/auth/webauthn/login/finish`
`register/finish` と同じ credential 形式を送り、成功すると `/auth/session` 相当のセッションが返る。

### GET `/auth/session`
`Authorization` ヘッダーだけで現在のセッションを再取得。
```json
{
  "userId": "0dbf...",
  "handle": "@cityglow",
  "saveMode": false,
  "ageMode": false,
  "expiresAt": "2024-08-25T11:28:00.000Z"
}
```

### POST `/auth/logout`
```json
{ "sessionToken": "sess_7ad5..." }
```
レスポンス: `{ "ok": true }`

## 投稿 / フィード

### GET `/feed`
```json
{
  "posts": [
    {
      "id": "efdb...",
      "title": "ネオンストリートの夜景",
      "description": "...",
      "duration_seconds": 18,
      "resolution": "1080x1920",
      "storage_key": "https://storage.example.com/videos/neon.mp4",
      "created_at": "2024-08-20T04:33:22.000Z",
      "sensitive": false,
      "ai_tags": [
        { "tag": "cyber", "trust": 0.94 },
        { "tag": "night", "trust": 0.9 }
      ],
      "post_stats": {
        "views": 12840,
        "watch_seconds": 86432,
        "bookmarks": 742,
        "follows": 311,
        "popularity": 94
      },
      "author": {
        "handle": "@cityglow",
        "displayName": "City Glow",
        "avatar": null,
        "bio": "都市生成AIアーティスト",
        "tagline": "Neon storyteller"
      }
    }
  ]
}
```

### GET `/feed/by-tag?tag=cyber`
レスポンスは `/feed` と同じ構造に `tag` フィールドが追加される。

### GET `/posts/:id`
```json
{
  "post": {
    "id": "efdb...",
    "title": "ネオンストリートの夜景",
    "description": "...",
    "duration_seconds": 18,
    "resolution": "1080x1920",
    "storage_key": "https://storage.example.com/videos/neon.mp4",
    "created_at": "2024-08-20T04:33:22.000Z",
    "sensitive": false,
    "ai_tags": [
      { "tag": "cyber", "trust": 0.94 },
      { "tag": "night", "trust": 0.9 }
    ],
    "post_stats": {
      "views": 12840,
      "watch_seconds": 86432,
      "bookmarks": 742,
      "follows": 311,
      "popularity": 94
    },
    "author": { "handle": "@cityglow", "displayName": "City Glow" },
    "comments": [
      {
        "id": "c0a4...",
        "body": "ミニマルな音も相性良さそう。",
        "created_at": "2024-08-20T05:10:00.000Z",
        "author": { "handle": "@midori_light", "displayName": "midori light" }
      }
    ]
  }
}
```

### POST `/posts`
セッション必須。Supabase Storage へアップロード済みの絶対 URL を送る。
```json
{
  "title": "Rain Tunnel Echo",
  "description": "生成リバーブで雨の軌跡を強調。",
  "storageKey": "https://storage.example.com/videos/rain_tunnel_echo.mp4",
  "durationSeconds": 19,
  "resolution": "1080x1920",
  "tags": ["rain", "tunnel", "echo"]
}
```
レスポンス: `{ "post": { ...PostDetail } }`

### POST `/posts/:id/comments`
```json
{ "body": "雲海の陰影をもっと見たい！" }
```
レスポンスにコメント ID + タイムスタンプが入る。

## ユーザー設定 / 統計

### GET `/user/preferences`
```json
{
  "handle": "@cityglow",
  "saveMode": true,
  "ageMode": false,
  "followTags": ["cyber", "rain"],
  "muteTags": ["sensitive"],
  "language": "ja"
}
```

### POST `/user/preferences`
```json
{
  "saveMode": true,
  "ageMode": true,
  "followTags": ["cyber", "tokyo"],
  "muteTags": ["sensitive", "nsfw"]
}
```
レスポンス `{ "ok": true }`

### POST `/stats/record_view`
```json
{
  "postId": "efdb...",
  "viewerId": "0dbf...",
  "durationSeconds": 8
}
```

### POST `/stats/record_watch`
```json
{
  "postId": "efdb...",
  "watchSeconds": 22
}
```

### POST `/stats/bookmark`
`{ "postId": "efdb..." }` -> `{ "bookmarks": 743 }`

### POST `/stats/follow_creator`
`{ "postId": "efdb...", "creatorHandle": "@cityglow" }` -> `{ "follows": 312 }`

## AI タグ

### GET `/posts/:id/tags`
```json
{
  "tags": [
    { "tag": "cyber", "trust": 0.94 },
    { "tag": "rain", "trust": 0.76 }
  ]
}
```

### GET `/tags/suggest?query=cyb`
```json
{
  "tags": [
    { "tag": "cyber", "popularity": 0.92 },
    { "tag": "cyberpunk", "popularity": 0.74 }
  ]
}
```

### POST `/tags/recompute`（管理バッチ用）
```json
{
  "postIds": ["efdb...", "ba91..."],
  "reason": "model_update_v2"
}
```
レスポンス: `{ "updated": 2 }`

---

これらの例は Next.js / Fastify 実装に合わせてシリアライズ済みの JSON を示している。レスポンススキーマが変わった場合は、同ファイルを更新し `docs/apps/frontend/lib/types.ts` に合わせて型シンクを行う。*** End Patch
