import { FastifyInstance } from 'fastify';
import { validateSession } from '../modules/session';
import { fetchPreferences, updatePreferences } from '../modules/preferences';

function requireToken(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.get('/user/preferences', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const { preferences } = await fetchPreferences(session.handle);
    return { preferences };
  });

  app.put('/user/preferences', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const body = (request.body as any) ?? {};
    const { preferences } = await updatePreferences(session.handle, {
      followTags: Array.isArray(body.followTags) ? body.followTags : undefined,
      muteTags: Array.isArray(body.muteTags) ? body.muteTags : undefined,
      saveMode: typeof body.saveMode === 'boolean' ? body.saveMode : undefined,
      ageMode: typeof body.ageMode === 'boolean' ? body.ageMode : undefined,
    });
    return { preferences };
  });
}
