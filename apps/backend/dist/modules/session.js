"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.validateSession = validateSession;
exports.refreshSession = refreshSession;
exports.destroySession = destroySession;
const crypto_1 = require("crypto");
const supabase_1 = require("../supabase");
const SESSION_TTL_MS = 30 * 60 * 1000;
function unwrapRelation(value) {
    if (!value)
        return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}
async function createSession(userId) {
    const token = (0, crypto_1.randomUUID)();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const { error } = await supabase_1.supabase.from('app_sessions').insert({ token, user_id: userId, expires_at: expiresAt });
    if (error)
        throw error;
    return { token, expiresAt };
}
async function validateSession(token) {
    if (!token)
        return null;
    const { data, error } = await supabase_1.supabase
        .from('app_sessions')
        .select('user_id, expires_at, app_users!inner(handle)')
        .eq('token', token)
        .maybeSingle();
    if (error || !data)
        return null;
    if (new Date(data.expires_at).getTime() < Date.now()) {
        await destroySession(token);
        return null;
    }
    const userRow = unwrapRelation(data.app_users);
    if (!userRow)
        return null;
    return { token, userId: data.user_id, handle: userRow.handle, expiresAt: data.expires_at };
}
async function refreshSession(token) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await supabase_1.supabase.from('app_sessions').update({ expires_at: expiresAt }).eq('token', token);
    return expiresAt;
}
async function destroySession(token) {
    await supabase_1.supabase.from('app_sessions').delete().eq('token', token);
}
