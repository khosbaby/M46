"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFeedRoutes = registerFeedRoutes;
const feed_1 = require("../modules/feed");
async function registerFeedRoutes(app) {
    app.get('/feed', async () => {
        const posts = await (0, feed_1.fetchFeed)();
        return { posts };
    });
    app.get('/feed/by-tag', async (request, reply) => {
        const tag = request.query.tag;
        if (!tag) {
            reply.code(400);
            return { error: 'tag_required' };
        }
        const posts = await (0, feed_1.fetchFeed)(tag);
        return { posts, tag };
    });
}
