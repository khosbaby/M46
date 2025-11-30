# Fallback Validation Plan

1. Network offline → Service Worker 無し → 最後の feed データを state から再描画
2. `/tags/suggest` 失敗 → fallback メッセージ表示
3. `/feed/by-tag` 404 → 人気順ロード
