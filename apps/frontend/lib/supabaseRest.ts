import 'server-only';

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

const SUPABASE_URL = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_KEY =
  readEnv('SUPABASE_SERVICE_ROLE_KEY') || readEnv('SUPABASE_SERVICE_KEY') || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const REST_BASE_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  searchParams?: Record<string, string>;
  body?: unknown;
  prefer?: string;
};

export async function supabaseRest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!REST_BASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('supabase_rest_not_configured');
  }
  const url = new URL(path.replace(/^\//, ''), REST_BASE_URL + '/');
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer ?? 'return=representation',
  };
  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`supabase_rest_error:${response.status}:${detail}`);
  }
  if (response.status === 204) {
    return [] as unknown as T;
  }
  return (await response.json()) as T;
}
