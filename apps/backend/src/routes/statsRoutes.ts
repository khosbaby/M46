import { FastifyInstance } from 'fastify';
import { validateSession } from '../modules/session';
import { recordView } from '../modules/stats';

function requireToken(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerStatsRoutes(app: FastifyInstance) {
  app.post('/stats/record_view', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const body = (request.body as any) ?? {};
    await recordView(body.postId, body.watchSeconds ?? 0);
    return { ok: true };
  });
}
