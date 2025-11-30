"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPasskeyRoutes = registerPasskeyRoutes;
const session_1 = require("../modules/session");
const passkeys_1 = require("../modules/passkeys");
function requireToken(request) {
    const auth = request.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7);
}
async function registerPasskeyRoutes(app) {
    app.get('/auth/passkeys', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const passkeys = await (0, passkeys_1.listPasskeys)(session.handle);
        return { passkeys };
    });
    app.delete('/auth/passkeys/:credentialId', async (request, reply) => {
        const token = requireToken(request);
        const session = await (0, session_1.validateSession)(token);
        if (!session) {
            reply.code(401);
            return { error: 'not_authenticated' };
        }
        const { credentialId } = request.params;
        await (0, passkeys_1.removePasskey)(session.handle, credentialId);
        return { ok: true };
    });
}
