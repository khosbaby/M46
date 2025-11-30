import { FastifyInstance } from 'fastify';
import { validateSession } from '../modules/session';
import { listPasskeys, removePasskey } from '../modules/passkeys';

function requireToken(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerPasskeyRoutes(app: FastifyInstance) {
  app.get('/auth/passkeys', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const passkeys = await listPasskeys(session.handle);
    return { passkeys };
  });

  app.delete('/auth/passkeys/:credentialId', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const { credentialId } = request.params as { credentialId: string };
    await removePasskey(session.handle, credentialId);
    return { ok: true };
  });
}
