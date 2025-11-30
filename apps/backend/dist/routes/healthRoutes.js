"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHealthRoutes = registerHealthRoutes;
const env_1 = require("../env");
async function registerHealthRoutes(app) {
    app.get('/health', async () => {
        return {
            status: 'ok',
            service: 'm46-backend',
            supabaseUrl: env_1.ENV.SUPABASE_URL,
            timestamp: new Date().toISOString(),
        };
    });
    app.get('/', async () => {
        return {
            message: 'M46 backend online',
            health: '/health',
            version: '0.1.0',
        };
    });
}
