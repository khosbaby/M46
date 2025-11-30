import { randomUUID } from 'crypto';
import { supabase } from '../supabase';

const SESSION_TTL_MS = 30 * 60 * 1000;

type SessionWithUserRow = {
  user_id: string;
  expires_at: string;
  app_users: { handle: string } | { handle: string }[] | null;
};

function unwrapRelation<T>(value?: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function createSession(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await supabase.from('app_sessions').insert({ token, user_id: userId, expires_at: expiresAt });
  if (error) throw error;
  return { token, expiresAt };
}

export async function validateSession(token?: string) {
  if (!token) return null;
  const { data, error } = await supabase
    .from('app_sessions')
    .select('user_id, expires_at, app_users!inner(handle)')
    .eq('token', token)
    .maybeSingle<SessionWithUserRow>();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  const userRow = unwrapRelation(data.app_users);
  if (!userRow) return null;
  return { token, userId: data.user_id, handle: userRow.handle, expiresAt: data.expires_at };
}

export async function refreshSession(token: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await supabase.from('app_sessions').update({ expires_at: expiresAt }).eq('token', token);
  return expiresAt;
}

export async function destroySession(token: string) {
  await supabase.from('app_sessions').delete().eq('token', token);
}
