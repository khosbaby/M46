"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStatsRoutes = registerStatsRoutes;
const session_1 = require("../modules/session");
const stats_1 = require("../modules/stats");
function requireToken(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerStatsRoutes(app) {
    app.post('/stats/record_view', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const body = request.body ?? {};
        await (0, stats_1.recordView)(body.postId, body.watchSeconds ?? 0);
        return { ok: true };
    });
}
