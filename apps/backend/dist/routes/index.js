"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const feedRoutes_1 = require("./feedRoutes");
const authRoutes_1 = require("./authRoutes");
const postRoutes_1 = require("./postRoutes");
const statsRoutes_1 = require("./statsRoutes");
const profileRoutes_1 = require("./profileRoutes");
const userRoutes_1 = require("./userRoutes");
const passkeyRoutes_1 = require("./passkeyRoutes");
const sessionRoutes_1 = require("./sessionRoutes");
const healthRoutes_1 = require("./healthRoutes");
async function registerRoutes(app) {
    await (0, feedRoutes_1.registerFeedRoutes)(app);
    await (0, authRoutes_1.registerAuthRoutes)(app);
    await (0, postRoutes_1.registerPostRoutes)(app);
    await (0, statsRoutes_1.registerStatsRoutes)(app);
    await (0, profileRoutes_1.registerProfileRoutes)(app);
    await (0, userRoutes_1.registerUserRoutes)(app);
    await (0, passkeyRoutes_1.registerPasskeyRoutes)(app);
    await (0, sessionRoutes_1.registerSessionRoutes)(app);
    await (0, healthRoutes_1.registerHealthRoutes)(app);
}
