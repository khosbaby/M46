import { FastifyInstance } from 'fastify';
import { fetchProfile, updateAvatar, updateProfile } from '../modules/appUsers';
import { validateSession } from '../modules/session';

function requireToken(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get('/profile/:handle', async (request) => {
    const { handle } = request.params as { handle: string };
    const profile = await fetchProfile(handle);
    return { profile };
  });

  app.put('/profile', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const body = (request.body as any) ?? {};
    const profile = await updateProfile(session.handle, {
      displayName: body.displayName,
      bio: body.bio,
      tagline: body.tagline,
    });
    return { profile };
  });

  app.post('/profile/avatar', async (request, reply) => {
    const token = requireToken(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const body = (request.body as any) ?? {};
    if (typeof body.imageData !== 'string' || !body.imageData.startsWith('data:image/')) {
      reply.code(422);
      return { error: 'invalid_image' };
    }
    const profile = await updateAvatar(session.handle, body.imageData);
    return { profile };
  });
}
