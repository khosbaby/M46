"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserWithAccount = createUserWithAccount;
exports.findUserById = findUserById;
const supabase_1 = require("../supabase");
async function findAppUserByHandle(handle) {
    const { data, error } = await supabase_1.supabase
        .from('app_users')
        .select('id, handle, display_name')
        .eq('handle', handle)
        .maybeSingle();
    if (error)
        throw error;
    return data ?? null;
}
async function findAppUserById(id) {
    const { data, error } = await supabase_1.supabase
        .from('app_users')
        .select('id, handle, display_name')
        .eq('id', id)
        .maybeSingle();
    if (error)
        throw error;
    return data ?? null;
}
async function ensureAccountRecord(userId, email, displayName) {
    const { data, error } = await supabase_1.supabase.from('accounts').select('id').eq('user_id', userId).maybeSingle();
    if (error)
        throw error;
    if (!data) {
        const { error: insertError } = await supabase_1.supabase.from('accounts').insert({
            user_id: userId,
            email,
            display_name: displayName || email,
        });
        if (insertError)
            throw insertError;
    }
}
async function ensureCreatorProfile(userId, displayName) {
    await supabase_1.supabase.from('creator_profiles').upsert({ user_id: userId, display_name: displayName }).select();
}
async function createUserWithAccount(handle, email, displayName, authUserId) {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const preferredDisplay = (displayName ?? handle).trim() || handle;
    if (authUserId) {
        const existingById = await findAppUserById(authUserId);
        if (existingById) {
            await ensureAccountRecord(existingById.id, normalizedEmail || `${existingById.handle}@demo.local`, existingById.display_name);
            await ensureCreatorProfile(existingById.id, existingById.display_name);
            return { userId: existingById.id, handle: existingById.handle };
        }
    }
    const existingByHandle = await findAppUserByHandle(handle);
    if (existingByHandle) {
        await ensureAccountRecord(existingByHandle.id, normalizedEmail || `${existingByHandle.handle}@demo.local`, existingByHandle.display_name || preferredDisplay);
        await ensureCreatorProfile(existingByHandle.id, existingByHandle.display_name || preferredDisplay);
        return { userId: existingByHandle.id, handle: existingByHandle.handle };
    }
    const insertPayload = {
        handle,
        display_name: preferredDisplay,
    };
    if (authUserId) {
        insertPayload.id = authUserId;
    }
    const { data: userRows, error: userError } = await supabase_1.supabase
        .from('app_users')
        .insert(insertPayload)
        .select('id, handle, display_name')
        .single();
    if (userError)
        throw userError;
    await ensureAccountRecord(userRows.id, normalizedEmail || `${handle}@demo.local`, userRows.display_name);
    await ensureCreatorProfile(userRows.id, userRows.display_name);
    return { userId: userRows.id, handle: userRows.handle };
}
async function findUserById(id) {
    return findAppUserById(id);
}
