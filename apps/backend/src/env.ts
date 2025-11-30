import { config } from 'dotenv';

config({ path: process.env.BACKEND_ENV_PATH ?? '.env' });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

function requiredOne(primary: string, fallback: string): string {
  const value = process.env[primary] ?? process.env[fallback];
  if (!value) {
    throw new Error(`Missing required env ${primary} (fallback ${fallback})`);
  }
  return value;
}

function optional(name: string, fallback?: string) {
  return process.env[name] ?? fallback;
}

function parseOrigins(value?: string) {
  if (!value) return undefined;
  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export const ENV = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: requiredOne('SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  PORT: Number(process.env.PORT ?? '3001'),
  FRONTEND_ORIGINS: parseOrigins(optional('FRONTEND_ORIGIN', 'http://localhost:3000,http://127.0.0.1:3000')),
  HOST: optional('HOST', '0.0.0.0'),
};
