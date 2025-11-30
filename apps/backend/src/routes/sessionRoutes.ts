import { FastifyInstance } from 'fastify';
import { createSession, destroySession, refreshSession, validateSession } from '../modules/session';
import { fetchProfile } from '../modules/appUsers';

function extractToken(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get('/auth/session', async (request) => {
    const token = extractToken(request);
    const session = await validateSession(token);
    if (!session) {
      return { authenticated: false };
    }
    const profile = await fetchProfile(session.handle);
    return { authenticated: true, sessionToken: session.token, sessionExpiresAt: session.expiresAt, profile };
  });

  app.post('/auth/session/refresh', async (request, reply) => {
    const token = extractToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const expiresAt = await refreshSession(session.token);
    return { sessionExpiresAt: expiresAt };
  });

  app.post('/auth/logout', async (request) => {
    const token = extractToken(request);
    if (token) {
      await destroySession(token);
    }
    return { ok: true };
  });
}
