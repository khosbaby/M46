"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ path: process.env.BACKEND_ENV_PATH ?? '.env' });
function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env ${name}`);
    }
    return value;
}
function requiredOne(primary, fallback) {
    const value = process.env[primary] ?? process.env[fallback];
    if (!value) {
        throw new Error(`Missing required env ${primary} (fallback ${fallback})`);
    }
    return value;
}
function optional(name, fallback) {
    return process.env[name] ?? fallback;
}
function parseOrigins(value) {
    if (!value)
        return undefined;
    return value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}
exports.ENV = {
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: requiredOne('SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
    PORT: Number(process.env.PORT ?? '3001'),
    FRONTEND_ORIGINS: parseOrigins(optional('FRONTEND_ORIGIN', 'http://localhost:3000,http://127.0.0.1:3000')),
    HOST: optional('HOST', '0.0.0.0'),
};
