const FALLBACK_API_BASE = 'http://127.0.0.1:4000';

export function resolveApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? FALLBACK_API_BASE).replace(/\/$/, '');
}
