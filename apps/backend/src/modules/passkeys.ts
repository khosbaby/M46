import { supabase } from '../supabase';

async function getAccountIdByHandle(handle: string) {
  const { data: user, error: userError } = await supabase.from('app_users').select('id').eq('handle', handle).single();
  if (userError || !user) throw userError ?? new Error('user_not_found');
  const { data: account, error: acctError } = await supabase.from('accounts').select('id').eq('user_id', user.id).single();
  if (acctError || !account) throw acctError ?? new Error('account_not_found');
  return account.id;
}

export async function listPasskeys(handle: string) {
  const accountId = await getAccountIdByHandle(handle);
  const { data, error } = await supabase
    .from('account_passkeys')
    .select('credential_id, device_label, transports, backed_up, created_at')
    .eq('account_id', accountId);
  if (error) throw error;
  return data?.map(row => ({
    credentialId: row.credential_id,
    device: row.device_label,
    transports: row.transports,
    backedUp: row.backed_up,
    createdAt: row.created_at,
  })) ?? [];
}

export async function removePasskey(handle: string, credentialId: string) {
  const accountId = await getAccountIdByHandle(handle);
  const { error } = await supabase
    .from('account_passkeys')
    .delete()
    .eq('credential_id', credentialId)
    .eq('account_id', accountId);
  if (error) throw error;
}
