"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getUserByHandle = getUserByHandle;
exports.ensureUserFromAuth = ensureUserFromAuth;
exports.fetchProfile = fetchProfile;
exports.updateProfile = updateProfile;
exports.updateAvatar = updateAvatar;
const zod_1 = require("zod");
const supabase_1 = require("../supabase");
const AppUserRow = zod_1.z.object({
    id: zod_1.z.string(),
    handle: zod_1.z.string(),
    display_name: zod_1.z.string(),
    created_at: zod_1.z.string(),
});
const CreatorProfileRow = zod_1.z.object({
    user_id: zod_1.z.string(),
    display_name: zod_1.z.string().nullable().optional(),
    avatar: zod_1.z.string().nullable().optional(),
    bio: zod_1.z.string().nullable().optional(),
    tagline: zod_1.z.string().nullable().optional(),
});
function normalizeHandle(handle) {
    return handle.trim();
}
function normalizeDisplayName(displayName, fallback) {
    const trimmed = (displayName ?? '').trim();
    return trimmed || fallback;
}
async function ensureAccountRecord(userId, email, displayName) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase_1.supabase.from('accounts').select('id').eq('user_id', userId).maybeSingle();
    if (error)
        throw error;
    if (data)
        return;
    const { error: insertError } = await supabase_1.supabase.from('accounts').insert({
        user_id: userId,
        email: normalizedEmail,
        display_name: displayName,
    });
    if (insertError)
        throw insertError;
}
async function ensureCreatorProfile(userId, displayName) {
    const { error } = await supabase_1.supabase.from('creator_profiles').upsert({ user_id: userId, display_name: displayName }).select();
    if (error)
        throw error;
}
async function getUserById(id) {
    const { data, error } = await supabase_1.supabase.from('app_users').select('id, handle, display_name, created_at').eq('id', id).maybeSingle();
    if (error)
        throw error;
    return data ? AppUserRow.parse(data) : null;
}
async function getUserByHandle(handle) {
    const normalized = normalizeHandle(handle);
    const { data, error } = await supabase_1.supabase.from('app_users').select('id, handle, display_name, created_at').eq('handle', normalized).maybeSingle();
    if (error)
        throw error;
    return data ? AppUserRow.parse(data) : null;
}
async function ensureUserFromAuth(params) {
    const normalizedHandle = normalizeHandle(params.handle);
    const preferredDisplay = normalizeDisplayName(params.displayName, normalizedHandle);
    const normalizedEmail = params.email.trim().toLowerCase() || `${normalizedHandle}@demo.local`;
    const existingById = await getUserById(params.authUserId);
    if (existingById) {
        await ensureAccountRecord(existingById.id, normalizedEmail, existingById.display_name || preferredDisplay);
        await ensureCreatorProfile(existingById.id, existingById.display_name || preferredDisplay);
        return existingById;
    }
    const existingByHandle = await getUserByHandle(normalizedHandle);
    if (existingByHandle) {
        await ensureAccountRecord(existingByHandle.id, normalizedEmail, existingByHandle.display_name || preferredDisplay);
        await ensureCreatorProfile(existingByHandle.id, existingByHandle.display_name || preferredDisplay);
        return existingByHandle;
    }
    const { data, error } = await supabase_1.supabase
        .from('app_users')
        .insert({ id: params.authUserId, handle: normalizedHandle, display_name: preferredDisplay })
        .select('id, handle, display_name, created_at')
        .single();
    if (error)
        throw error;
    const user = AppUserRow.parse(data);
    await ensureAccountRecord(user.id, normalizedEmail, user.display_name);
    await ensureCreatorProfile(user.id, user.display_name);
    return user;
}
async function fetchProfile(handle) {
    const normalizedHandle = normalizeHandle(handle);
    const { data, error } = await supabase_1.supabase
        .from('app_users')
        .select('id, handle, display_name, creator_profiles(display_name, avatar, bio, tagline)')
        .eq('handle', normalizedHandle)
        .maybeSingle();
    if (error)
        throw error;
    if (!data)
        return null;
    const profileRow = Array.isArray(data.creator_profiles) ? data.creator_profiles[0] : data.creator_profiles;
    return {
        handle: data.handle,
        displayName: profileRow?.display_name ?? data.display_name,
        avatar: profileRow?.avatar ?? null,
        bio: profileRow?.bio ?? null,
        tagline: profileRow?.tagline ?? null,
        userId: data.id,
    };
}
async function updateProfile(handle, payload) {
    const profile = await fetchProfile(handle);
    if (!profile)
        throw new Error('profile_not_found');
    const nextDisplay = normalizeDisplayName(payload.displayName, profile.displayName ?? handle);
    await supabase_1.supabase
        .from('creator_profiles')
        .upsert({
        user_id: profile.userId,
        display_name: nextDisplay,
        bio: payload.bio ?? profile.bio,
        tagline: payload.tagline ?? profile.tagline,
    })
        .select();
    await supabase_1.supabase.from('app_users').update({ display_name: nextDisplay }).eq('id', profile.userId);
    return fetchProfile(handle);
}
async function updateAvatar(handle, imageData) {
    const profile = await fetchProfile(handle);
    if (!profile)
        throw new Error('profile_not_found');
    await supabase_1.supabase
        .from('creator_profiles')
        .upsert({
        user_id: profile.userId,
        display_name: profile.displayName ?? handle,
        avatar: imageData,
        bio: profile.bio,
        tagline: profile.tagline,
    })
        .select();
    return fetchProfile(handle);
}
