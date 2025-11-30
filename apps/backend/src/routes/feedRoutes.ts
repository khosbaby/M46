import { FastifyInstance } from 'fastify';
import { fetchFeed } from '../modules/feed';

export async function registerFeedRoutes(app: FastifyInstance) {
  app.get('/feed', async () => {
    const posts = await fetchFeed();
    return { posts };
  });

  app.get('/feed/by-tag', async (request, reply) => {
    const tag = (request.query as { tag?: string }).tag;
    if (!tag) {
      reply.code(400);
      return { error: 'tag_required' };
    }
    const posts = await fetchFeed(tag);
    return { posts, tag };
  });
}
