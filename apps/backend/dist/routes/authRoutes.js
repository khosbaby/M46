"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = registerAuthRoutes;
const crypto_1 = require("crypto");
const auth_1 = require("../modules/auth");
const appUsers_1 = require("../modules/appUsers");
const session_1 = require("../modules/session");
const supabase_1 = require("../supabase");
async function findAccountByEmail(email) {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase_1.supabase
        .from('accounts')
        .select('user_id, app_users!inner(handle)')
        .eq('email', normalized)
        .maybeSingle();
    if (error || !data)
        return null;
    const user = Array.isArray(data.app_users) ? data.app_users[0] : data.app_users;
    if (!user)
        return null;
    return { userId: data.user_id, handle: user.handle };
}
async function registerAuthRoutes(app) {
    app.post('/auth/webauthn/register/start', async (request, reply) => {
        const body = request.body ?? {};
        if (!body.handle || !body.email) {
            reply.code(422);
            return { error: 'handle_email_required' };
        }
        const existingUser = await (0, appUsers_1.getUserByHandle)(body.handle);
        const authUserId = existingUser?.id ?? (0, crypto_1.randomUUID)();
        const record = (0, auth_1.issueChallenge)({ type: 'register', handle: body.handle, email: body.email, authUserId });
        return { challenge: record.challenge, handle: record.handle, authUserId };
    });
    app.post('/auth/webauthn/register/finish', async (request, reply) => {
        const body = request.body ?? {};
        const record = (0, auth_1.consumeChallenge)(body.challenge);
        if (!record || record.type !== 'register') {
            reply.code(400);
            return { error: 'invalid_challenge' };
        }
        const authUserId = record.authUserId ?? (0, crypto_1.randomUUID)();
        const user = await (0, appUsers_1.ensureUserFromAuth)({
            authUserId,
            handle: record.handle,
            email: record.email ?? `${record.handle}@demo.local`,
            displayName: record.handle,
        });
        if (body.passkey) {
            await (0, auth_1.persistPasskey)(record.handle, body.passkey, body.deviceLabel);
        }
        const session = await (0, session_1.createSession)(user.id);
        return { sessionToken: session.token, sessionExpiresAt: session.expiresAt, handle: record.handle };
    });
    app.post('/auth/webauthn/login/start', async (request, reply) => {
        const body = request.body ?? {};
        if (!body.handle) {
            reply.code(422);
            return { error: 'handle_required' };
        }
        const user = await (0, appUsers_1.getUserByHandle)(body.handle);
        if (!user) {
            reply.code(404);
            return { error: 'user_not_found' };
        }
        const record = (0, auth_1.issueChallenge)({ type: 'login', handle: body.handle, authUserId: user.id });
        return { challenge: record.challenge, handle: record.handle };
    });
    app.post('/auth/webauthn/login/finish', async (request, reply) => {
        const body = request.body ?? {};
        const record = (0, auth_1.consumeChallenge)(body.challenge);
        if (!record || record.type !== 'login') {
            reply.code(400);
            return { error: 'invalid_challenge' };
        }
        if (!body.passkey) {
            reply.code(422);
            return { error: 'passkey_required' };
        }
        let resolvedUser = null;
        try {
            const validation = await (0, auth_1.validatePasskeyAssertion)(record.handle, body.passkey);
            const authUserId = validation.userHandle ?? record.authUserId;
            if (authUserId) {
                resolvedUser = await (0, appUsers_1.getUserById)(authUserId);
            }
        }
        catch (error) {
            reply.code(401);
            return { error: 'passkey_invalid' };
        }
        if (!resolvedUser) {
            resolvedUser = await (0, appUsers_1.getUserByHandle)(record.handle);
        }
        if (!resolvedUser) {
            reply.code(404);
            return { error: 'user_not_found' };
        }
        const session = await (0, session_1.createSession)(resolvedUser.id);
        return { sessionToken: session.token, sessionExpiresAt: session.expiresAt, handle: record.handle };
    });
    app.post('/auth/email/start', async (request, reply) => {
        const body = request.body ?? {};
        const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
        if (!rawEmail) {
            reply.code(422);
            return { error: 'email_required' };
        }
        const account = await findAccountByEmail(rawEmail);
        if (!account) {
            reply.code(404);
            return { error: 'user_not_found' };
        }
        const otp = (0, auth_1.generateOtpCode)();
        const record = (0, auth_1.issueChallenge)({ type: 'email_login', handle: account.handle, email: rawEmail.toLowerCase(), otp });
        const devCode = process.env.NODE_ENV !== 'production' ? otp : undefined;
        return { challenge: record.challenge, otpPreview: devCode };
    });
    app.post('/auth/email/finish', async (request, reply) => {
        const body = request.body ?? {};
        const record = (0, auth_1.consumeChallenge)(body.challenge);
        if (!record || record.type !== 'email_login' || !record.otp) {
            reply.code(400);
            return { error: 'invalid_challenge' };
        }
        if (String(body.code ?? '').trim() !== record.otp) {
            reply.code(400);
            return { error: 'invalid_code' };
        }
        const user = await (0, appUsers_1.getUserByHandle)(record.handle);
        if (!user) {
            reply.code(404);
            return { error: 'user_not_found' };
        }
        const session = await (0, session_1.createSession)(user.id);
        return { sessionToken: session.token, sessionExpiresAt: session.expiresAt, handle: record.handle };
    });
}
