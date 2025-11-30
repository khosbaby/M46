import { FastifyInstance } from 'fastify';
import { createPost, fetchPostDetail, listPosts } from '../modules/posts';
import { validateSession } from '../modules/session';
import { ZodError } from 'zod';

function requireAuthHeader(request: any) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function registerPostRoutes(app: FastifyInstance) {
  app.get('/api/posts', async () => {
    const posts = await listPosts();
    return { posts };
  });

  app.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await fetchPostDetail(id);
    return { post };
  });

  app.post('/posts', async (request, reply) => {
    const token = requireAuthHeader(request);
    const session = await validateSession(token);
    if (!session) {
      reply.code(401);
      return { error: 'not_authenticated' };
    }
    const body = (request.body as any) ?? {};
    try {
      const post = await createPost({
        ownerId: session.userId,
        title: body.title,
        description: body.description,
        storageKey: body.storageKey,
        durationSeconds: body.durationSeconds,
        resolution: body.resolution,
        tags: body.tags ?? [],
      });
      return { post };
    } catch (error) {
      if (error instanceof ZodError) {
        reply.code(400);
        return { error: 'invalid_post_payload', issues: error.flatten() };
      }
      throw error;
    }
  });
}
