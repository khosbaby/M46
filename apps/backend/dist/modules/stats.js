"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordView = recordView;
const supabase_1 = require("../supabase");
async function recordView(postId, seconds) {
    await supabase_1.supabase.rpc('recompute_popularity', { p_post: postId });
    await supabase_1.supabase
        .from('post_stats')
        .upsert({
        post_id: postId,
        views: 1,
        watch_seconds: seconds,
    }, { onConflict: 'post_id' });
}
