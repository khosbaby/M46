import { supabase } from '../supabase';
import { randomUUID } from 'crypto';
import { z } from 'zod';

type ChallengeRecord = {
  challenge: string;
  type: 'register' | 'login' | 'email_login';
  handle: string;
  email?: string;
  otp?: string;
  authUserId?: string;
};

const challengeStore = new Map<string, ChallengeRecord>();

export function issueChallenge(payload: Omit<ChallengeRecord, 'challenge'>): ChallengeRecord {
  const challenge = randomUUID();
  const record = { ...payload, challenge };
  challengeStore.set(challenge, record);
  setTimeout(() => challengeStore.delete(challenge), 5 * 60 * 1000);
  return record;
}

export function consumeChallenge(challenge: string) {
  const record = challengeStore.get(challenge);
  if (record) challengeStore.delete(challenge);
  return record;
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const PasskeyRegistrationPayload = z.object({
  id: z.string(),
  rawId: z.string().optional(),
  type: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string().optional(),
    transports: z.array(z.string()).optional(),
  }),
});

const PasskeyAssertionPayload = z.object({
  id: z.string(),
  rawId: z.string().optional(),
  type: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string().optional(),
    signature: z.string().optional(),
    userHandle: z.string().optional().nullable(),
  }),
});

async function resolveAccountContext(handle: string) {
  const { data: user, error: userError } = await supabase.from('app_users').select('id').eq('handle', handle).maybeSingle();
  if (userError || !user) throw userError ?? new Error('user_not_found');
  const { data: account, error: accountError } = await supabase.from('accounts').select('id').eq('user_id', user.id).maybeSingle();
  if (accountError || !account) throw accountError ?? new Error('account_not_found');
  return { userId: user.id, accountId: account.id };
}

function decodeBase64Url(value: string) {
  if (!value) return Buffer.alloc(0);
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(padLength), 'base64');
}

function normalizeDeviceLabel(label?: string | null) {
  if (!label) return 'WebAuthn device';
  const trimmed = label.trim();
  return trimmed ? trimmed.slice(0, 120) : 'WebAuthn device';
}

export async function persistPasskey(handle: string, passkey: unknown, deviceLabel?: string) {
  const credential = PasskeyRegistrationPayload.parse(passkey);
  const { accountId } = await resolveAccountContext(handle);
  const attestation = credential.response.attestationObject ? decodeBase64Url(credential.response.attestationObject) : null;
  const transports = credential.response.transports ?? [];
  const label = normalizeDeviceLabel(deviceLabel);
  const credentialId = credential.rawId ?? credential.id;
  const { error } = await supabase
    .from('account_passkeys')
    .upsert(
      {
        account_id: accountId,
        credential_id: credentialId,
        transports,
        backed_up: false,
        device_label: label,
        attestation_object: attestation,
        client_data_hash: credential.response.clientDataJSON,
      },
      { onConflict: 'credential_id' }
    );
  if (error) throw error;
}

export async function validatePasskeyAssertion(handle: string, assertion: unknown) {
  const payload = PasskeyAssertionPayload.parse(assertion);
  const credentialId = payload.rawId ?? payload.id;
  const userHandleBuffer = payload.response.userHandle ? decodeBase64Url(payload.response.userHandle) : null;
  const userHandle = userHandleBuffer ? userHandleBuffer.toString('utf-8').trim() || undefined : undefined;
  const { accountId } = await resolveAccountContext(handle);
  const { data, error } = await supabase
    .from('account_passkeys')
    .select('credential_id')
    .eq('account_id', accountId)
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('passkey_not_registered');
  }
  return { credentialId, userHandle };
}
