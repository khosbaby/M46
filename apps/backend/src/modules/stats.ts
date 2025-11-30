import { supabase } from '../supabase';

export async function recordView(postId: string, seconds: number) {
  await supabase.rpc('recompute_popularity', { p_post: postId });
  await supabase
    .from('post_stats')
    .upsert(
      {
        post_id: postId,
        views: 1,
        watch_seconds: seconds,
      },
      { onConflict: 'post_id' }
    );
}
