"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProfile = fetchProfile;
exports.updateProfile = updateProfile;
exports.updateAvatar = updateAvatar;
const supabase_1 = require("../supabase");
function unwrapRelation(value) {
    if (!value)
        return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}
async function fetchProfile(handle) {
    const { data, error } = await supabase_1.supabase
        .from('app_users')
        .select('id, handle, creator_profiles(display_name, avatar, bio, tagline)')
        .eq('handle', handle)
        .single();
    if (error || !data)
        throw error ?? new Error('profile_not_found');
    const creatorProfile = unwrapRelation(data.creator_profiles);
    return {
        handle: data.handle,
        displayName: creatorProfile?.display_name ?? data.handle,
        avatar: creatorProfile?.avatar,
        bio: creatorProfile?.bio,
        tagline: creatorProfile?.tagline,
        userId: data.id,
    };
}
async function updateProfile(handle, payload) {
    const profile = await fetchProfile(handle);
    await supabase_1.supabase
        .from('creator_profiles')
        .upsert({
        user_id: profile.userId,
        display_name: payload.displayName ?? profile.displayName,
        bio: payload.bio ?? profile.bio,
        tagline: payload.tagline ?? profile.tagline,
    });
    return fetchProfile(handle);
}
async function updateAvatar(handle, imageData) {
    const profile = await fetchProfile(handle);
    await supabase_1.supabase
        .from('creator_profiles')
        .upsert({
        user_id: profile.userId,
        display_name: profile.displayName,
        avatar: imageData,
    });
    return fetchProfile(handle);
}
