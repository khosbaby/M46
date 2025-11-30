"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPostRoutes = registerPostRoutes;
const posts_1 = require("../modules/posts");
const session_1 = require("../modules/session");
const zod_1 = require("zod");
function requireAuthHeader(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerPostRoutes(app) {
    app.get('/api/posts', async () => {
        const posts = await (0, posts_1.listPosts)();
        return { posts };
    });
    app.get('/posts/:id', async (request, reply) => {
        const { id } = request.params;
        const post = await (0, posts_1.fetchPostDetail)(id);
        return { post };
    });
    app.post('/posts', async (request, reply) => {
        const token = requireAuthHeader(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const body = request.body ?? {};
        try {
            const post = await (0, posts_1.createPost)({
                ownerId: session.userId,
                title: body.title,
                description: body.description,
                storageKey: body.storageKey,
                durationSeconds: body.durationSeconds,
                resolution: body.resolution,
                tags: body.tags ?? [],
            });
            return { post };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                reply.code(400);
                return { error: 'invalid_post_payload', issues: error.flatten() };
            }
            throw error;
        }
    });
}
