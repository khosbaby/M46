import { z } from 'zod';
import { supabase } from '../supabase';

const AppUserRow = z.object({
  id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  created_at: z.string(),
});

const CreatorProfileRow = z.object({
  user_id: z.string(),
  display_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
});

type AppUserRecord = z.infer<typeof AppUserRow>;
type CreatorProfileRecord = z.infer<typeof CreatorProfileRow>;

function normalizeHandle(handle: string) {
  return handle.trim();
}

function normalizeDisplayName(displayName: string | undefined, fallback: string) {
  const trimmed = (displayName ?? '').trim();
  return trimmed || fallback;
}

async function ensureAccountRecord(userId: string, email: string, displayName: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.from('accounts').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await supabase.from('accounts').insert({
    user_id: userId,
    email: normalizedEmail,
    display_name: displayName,
  });
  if (insertError) throw insertError;
}

async function ensureCreatorProfile(userId: string, displayName: string) {
  const { error } = await supabase.from('creator_profiles').upsert({ user_id: userId, display_name: displayName }).select();
  if (error) throw error;
}

export async function getUserById(id: string) {
  const { data, error } = await supabase.from('app_users').select('id, handle, display_name, created_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? AppUserRow.parse(data) : null;
}

export async function getUserByHandle(handle: string) {
  const normalized = normalizeHandle(handle);
  const { data, error } = await supabase.from('app_users').select('id, handle, display_name, created_at').eq('handle', normalized).maybeSingle();
  if (error) throw error;
  return data ? AppUserRow.parse(data) : null;
}

type EnsureUserParams = {
  authUserId: string;
  handle: string;
  email: string;
  displayName?: string;
};

export async function ensureUserFromAuth(params: EnsureUserParams): Promise<AppUserRecord> {
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

  const { data, error } = await supabase
    .from('app_users')
    .insert({ id: params.authUserId, handle: normalizedHandle, display_name: preferredDisplay })
    .select('id, handle, display_name, created_at')
    .single();
  if (error) throw error;
  const user = AppUserRow.parse(data);
  await ensureAccountRecord(user.id, normalizedEmail, user.display_name);
  await ensureCreatorProfile(user.id, user.display_name);
  return user;
}

type ProfilePayload = {
  displayName?: string;
  bio?: string;
  tagline?: string;
};

export async function fetchProfile(handle: string) {
  const normalizedHandle = normalizeHandle(handle);
  const { data, error } = await supabase
    .from('app_users')
    .select('id, handle, display_name, creator_profiles(display_name, avatar, bio, tagline)')
    .eq('handle', normalizedHandle)
    .maybeSingle<{
      id: string;
      handle: string;
      display_name: string;
      creator_profiles: CreatorProfileRecord | CreatorProfileRecord[] | null;
    }>();
  if (error) throw error;
  if (!data) return null;
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

export async function updateProfile(handle: string, payload: ProfilePayload) {
  const profile = await fetchProfile(handle);
  if (!profile) throw new Error('profile_not_found');
  const nextDisplay = normalizeDisplayName(payload.displayName, profile.displayName ?? handle);
  await supabase
    .from('creator_profiles')
    .upsert({
      user_id: profile.userId,
      display_name: nextDisplay,
      bio: payload.bio ?? profile.bio,
      tagline: payload.tagline ?? profile.tagline,
    })
    .select();
  await supabase.from('app_users').update({ display_name: nextDisplay }).eq('id', profile.userId);
  return fetchProfile(handle);
}

export async function updateAvatar(handle: string, imageData: string) {
  const profile = await fetchProfile(handle);
  if (!profile) throw new Error('profile_not_found');
  await supabase
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
