# Security Checklist (Phase4)

- [ ] レート制限: `/auth` `/posts` `/stats` で 429 応答確認
- [ ] セッション固定化: cookie 再発行、token rotation
- [ ] 署名URL期限切れ: `/legal` `/sample-video` で期限テスト
- [ ] XSS/CSRF: フロント sanitization, fetch JSON only
