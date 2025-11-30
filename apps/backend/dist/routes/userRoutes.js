"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserRoutes = registerUserRoutes;
const session_1 = require("../modules/session");
const preferences_1 = require("../modules/preferences");
function requireToken(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerUserRoutes(app) {
    app.get('/user/preferences', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const { preferences } = await (0, preferences_1.fetchPreferences)(session.handle);
        return { preferences };
    });
    app.put('/user/preferences', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const body = request.body ?? {};
        const { preferences } = await (0, preferences_1.updatePreferences)(session.handle, {
            followTags: Array.isArray(body.followTags) ? body.followTags : undefined,
            muteTags: Array.isArray(body.muteTags) ? body.muteTags : undefined,
            saveMode: typeof body.saveMode === 'boolean' ? body.saveMode : undefined,
            ageMode: typeof body.ageMode === 'boolean' ? body.ageMode : undefined,
        });
        return { preferences };
    });
}
