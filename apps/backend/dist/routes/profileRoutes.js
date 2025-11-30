"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProfileRoutes = registerProfileRoutes;
const appUsers_1 = require("../modules/appUsers");
const session_1 = require("../modules/session");
function requireToken(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerProfileRoutes(app) {
    app.get('/profile/:handle', async (request) => {
        const { handle } = request.params;
        const profile = await (0, appUsers_1.fetchProfile)(handle);
        return { profile };
    });
    app.put('/profile', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const body = request.body ?? {};
        const profile = await (0, appUsers_1.updateProfile)(session.handle, {
            displayName: body.displayName,
            bio: body.bio,
            tagline: body.tagline,
        });
        return { profile };
    });
    app.post('/profile/avatar', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const body = request.body ?? {};
        if (typeof body.imageData !== 'string' || !body.imageData.startsWith('data:image/')) {
            reply.code(422);
            return { error: 'invalid_image' };
        }
        const profile = await (0, appUsers_1.updateAvatar)(session.handle, body.imageData);
        return { profile };
    });
}
