import { SupabaseClientAdapter } from './supabaseMcpClient';

export const SESSION_REFRESH_MS = 30 * 60 * 1000;

export class SessionError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function resolveSession(client: SupabaseClientAdapter, token: string) {
  if (!token) {
    throw new SessionError('missing_session_token', 401);
  }
  const sessionResult = await client.select({
    table: 'app_sessions',
    columns: ['user_id', 'expires_at'],
    filters: { token },
    limit: 1,
  });
  const sessionRow = sessionResult.rows[0];
  if (!sessionRow || !sessionRow.user_id) {
    throw new SessionError('invalid_session', 401);
  }
  const expiresAt = typeof sessionRow.expires_at === 'string' ? sessionRow.expires_at : '';
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    await client.remove({ table: 'app_sessions', filters: { token } });
    throw new SessionError('session_expired', 401);
  }
  await client.update({
    table: 'app_sessions',
    filters: { token },
    changes: { expires_at: new Date(Date.now() + SESSION_REFRESH_MS).toISOString() },
  });
  const userResult = await client.select({
    table: 'app_users',
    columns: ['id', 'handle'],
    filters: { id: sessionRow.user_id },
    limit: 1,
  });
  const user = userResult.rows[0];
  if (!user?.id) {
    throw new SessionError('session_user_missing', 401);
  }
  return {
    userId: String(user.id),
    handle: typeof user.handle === 'string' ? user.handle : '',
  };
}
