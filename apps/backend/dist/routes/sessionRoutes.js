"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSessionRoutes = registerSessionRoutes;
const session_1 = require("../modules/session");
const appUsers_1 = require("../modules/appUsers");
function extractToken(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerSessionRoutes(app) {
    app.get('/auth/session', async (request) => {
        const token = extractToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            return { authenticated: false };
        }
        const profile = await (0, appUsers_1.fetchProfile)(session.handle);
        return { authenticated: true, sessionToken: session.token, sessionExpiresAt: session.expiresAt, profile };
    });
    app.post('/auth/session/refresh', async (request, reply) => {
        const token = extractToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const expiresAt = await (0, session_1.refreshSession)(session.token);
        return { sessionExpiresAt: expiresAt };
    });
    app.post('/auth/logout', async (request) => {
        const token = extractToken(request);
        if (token) {
            await (0, session_1.destroySession)(token);
        }
        return { ok: true };
    });
}
