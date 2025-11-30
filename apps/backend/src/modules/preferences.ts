import { supabase } from '../supabase';

type PreferencesPayload = {
  followTags?: string[];
  muteTags?: string[];
  saveMode?: boolean;
  ageMode?: boolean;
};

export async function fetchPreferences(handle: string) {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, save_mode, age_mode, user_follow_tags(tag, position), user_mute_tags(tag)')
    .eq('handle', handle)
    .single();
  if (error || !data) throw error ?? new Error('user_not_found');
  const followTags =
    data.user_follow_tags?.map(entry => ({
      tag: entry.tag,
      position: (entry as any).position ?? 0,
    })) ?? [];
  const muteTags = data.user_mute_tags?.map(entry => entry.tag) ?? [];
  followTags.sort((a, b) => a.position - b.position);
  return {
    userId: data.id,
    preferences: {
      followTags: followTags.map(entry => entry.tag),
      muteTags,
      saveMode: data.save_mode,
      ageMode: data.age_mode,
    },
  };
}

export async function updatePreferences(handle: string, payload: PreferencesPayload) {
  const current = await fetchPreferences(handle);
  const userId = current.userId;
  const updates: Record<string, any> = {};
  if (typeof payload.saveMode === 'boolean') updates.save_mode = payload.saveMode;
  if (typeof payload.ageMode === 'boolean') updates.age_mode = payload.ageMode;
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('app_users').update(updates).eq('id', userId);
    if (error) throw error;
  }
  if (payload.followTags) {
    await supabase.from('user_follow_tags').delete().eq('user_id', userId);
    if (payload.followTags.length) {
      const followRows = payload.followTags.map((tag, index) => ({
        user_id: userId,
        tag,
        position: index,
      }));
      await supabase.from('user_follow_tags').insert(followRows);
    }
  }
  if (payload.muteTags) {
    await supabase.from('user_mute_tags').delete().eq('user_id', userId);
    if (payload.muteTags.length) {
      const muteRows = payload.muteTags.map(tag => ({
        user_id: userId,
        tag,
      }));
      await supabase.from('user_mute_tags').insert(muteRows);
    }
  }
  return fetchPreferences(handle);
}
