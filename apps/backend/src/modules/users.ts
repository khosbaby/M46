import { supabase } from '../supabase';

type AppUserRow = {
  id: string;
  handle: string;
  display_name: string;
};

async function findAppUserByHandle(handle: string) {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, handle, display_name')
    .eq('handle', handle)
    .maybeSingle<AppUserRow>();
  if (error) throw error;
  return data ?? null;
}

async function findAppUserById(id: string) {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, handle, display_name')
    .eq('id', id)
    .maybeSingle<AppUserRow>();
  if (error) throw error;
  return data ?? null;
}

async function ensureAccountRecord(userId: string, email: string, displayName: string) {
  const { data, error } = await supabase.from('accounts').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await supabase.from('accounts').insert({
      user_id: userId,
      email,
      display_name: displayName || email,
    });
    if (insertError) throw insertError;
  }
}

async function ensureCreatorProfile(userId: string, displayName: string) {
  await supabase.from('creator_profiles').upsert({ user_id: userId, display_name: displayName }).select();
}

export async function createUserWithAccount(handle: string, email: string, displayName?: string, authUserId?: string) {
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  const preferredDisplay = (displayName ?? handle).trim() || handle;

  if (authUserId) {
    const existingById = await findAppUserById(authUserId);
    if (existingById) {
      await ensureAccountRecord(existingById.id, normalizedEmail || `${existingById.handle}@demo.local`, existingById.display_name);
      await ensureCreatorProfile(existingById.id, existingById.display_name);
      return { userId: existingById.id, handle: existingById.handle };
    }
  }

  const existingByHandle = await findAppUserByHandle(handle);
  if (existingByHandle) {
    await ensureAccountRecord(
      existingByHandle.id,
      normalizedEmail || `${existingByHandle.handle}@demo.local`,
      existingByHandle.display_name || preferredDisplay
    );
    await ensureCreatorProfile(existingByHandle.id, existingByHandle.display_name || preferredDisplay);
    return { userId: existingByHandle.id, handle: existingByHandle.handle };
  }

  const insertPayload: { id?: string; handle: string; display_name: string } = {
    handle,
    display_name: preferredDisplay,
  };
  if (authUserId) {
    insertPayload.id = authUserId;
  }
  const { data: userRows, error: userError } = await supabase
    .from('app_users')
    .insert(insertPayload)
    .select('id, handle, display_name')
    .single<AppUserRow>();
  if (userError) throw userError;
  await ensureAccountRecord(userRows.id, normalizedEmail || `${handle}@demo.local`, userRows.display_name);
  await ensureCreatorProfile(userRows.id, userRows.display_name);
  return { userId: userRows.id, handle: userRows.handle };
}

export async function findUserById(id: string) {
  return findAppUserById(id);
}
