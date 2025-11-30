"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueChallenge = issueChallenge;
exports.consumeChallenge = consumeChallenge;
exports.generateOtpCode = generateOtpCode;
exports.persistPasskey = persistPasskey;
exports.validatePasskeyAssertion = validatePasskeyAssertion;
const supabase_1 = require("../supabase");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const challengeStore = new Map();
function issueChallenge(payload) {
    const challenge = (0, crypto_1.randomUUID)();
    const record = { ...payload, challenge };
    challengeStore.set(challenge, record);
    setTimeout(() => challengeStore.delete(challenge), 5 * 60 * 1000);
    return record;
}
function consumeChallenge(challenge) {
    const record = challengeStore.get(challenge);
    if (record)
        challengeStore.delete(challenge);
    return record;
}
function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
const PasskeyRegistrationPayload = zod_1.z.object({
    id: zod_1.z.string(),
    rawId: zod_1.z.string().optional(),
    type: zod_1.z.string(),
    response: zod_1.z.object({
        clientDataJSON: zod_1.z.string(),
        attestationObject: zod_1.z.string().optional(),
        transports: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const PasskeyAssertionPayload = zod_1.z.object({
    id: zod_1.z.string(),
    rawId: zod_1.z.string().optional(),
    type: zod_1.z.string(),
    response: zod_1.z.object({
        clientDataJSON: zod_1.z.string(),
        authenticatorData: zod_1.z.string().optional(),
        signature: zod_1.z.string().optional(),
        userHandle: zod_1.z.string().optional().nullable(),
    }),
});
async function resolveAccountContext(handle) {
    const { data: user, error: userError } = await supabase_1.supabase.from('app_users').select('id').eq('handle', handle).maybeSingle();
    if (userError || !user)
        throw userError ?? new Error('user_not_found');
    const { data: account, error: accountError } = await supabase_1.supabase.from('accounts').select('id').eq('user_id', user.id).maybeSingle();
    if (accountError || !account)
        throw accountError ?? new Error('account_not_found');
    return { userId: user.id, accountId: account.id };
}
function decodeBase64Url(value) {
    if (!value)
        return Buffer.alloc(0);
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
    return Buffer.from(normalized + '='.repeat(padLength), 'base64');
}
function normalizeDeviceLabel(label) {
    if (!label)
        return 'WebAuthn device';
    const trimmed = label.trim();
    return trimmed ? trimmed.slice(0, 120) : 'WebAuthn device';
}
async function persistPasskey(handle, passkey, deviceLabel) {
    const credential = PasskeyRegistrationPayload.parse(passkey);
    const { accountId } = await resolveAccountContext(handle);
    const attestation = credential.response.attestationObject ? decodeBase64Url(credential.response.attestationObject) : null;
    const transports = credential.response.transports ?? [];
    const label = normalizeDeviceLabel(deviceLabel);
    const credentialId = credential.rawId ?? credential.id;
    const { error } = await supabase_1.supabase
        .from('account_passkeys')
        .upsert({
        account_id: accountId,
        credential_id: credentialId,
        transports,
        backed_up: false,
        device_label: label,
        attestation_object: attestation,
        client_data_hash: credential.response.clientDataJSON,
    }, { onConflict: 'credential_id' });
    if (error)
        throw error;
}
async function validatePasskeyAssertion(handle, assertion) {
    const payload = PasskeyAssertionPayload.parse(assertion);
    const credentialId = payload.rawId ?? payload.id;
    const userHandleBuffer = payload.response.userHandle ? decodeBase64Url(payload.response.userHandle) : null;
    const userHandle = userHandleBuffer ? userHandleBuffer.toString('utf-8').trim() || undefined : undefined;
    const { accountId } = await resolveAccountContext(handle);
    const { data, error } = await supabase_1.supabase
        .from('account_passkeys')
        .select('credential_id')
        .eq('account_id', accountId)
        .eq('credential_id', credentialId)
        .maybeSingle();
    if (error)
        throw error;
    if (!data) {
        throw new Error('passkey_not_registered');
    }
    return { credentialId, userHandle };
}
