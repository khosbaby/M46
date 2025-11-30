"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const routes_1 = require("./routes");
const env_1 = require("./env");
async function main() {
    const app = (0, fastify_1.default)({
        logger: true,
    });
    await app.register(cors_1.default, {
        origin: env_1.ENV.FRONTEND_ORIGINS,
        credentials: true,
    });
    await (0, routes_1.registerRoutes)(app);
    try {
        await app.listen({ port: env_1.ENV.PORT, host: env_1.ENV.HOST });
        console.log(`Backend API ready on http://${env_1.ENV.HOST}:${env_1.ENV.PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
main();
