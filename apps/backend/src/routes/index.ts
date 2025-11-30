import { FastifyInstance } from 'fastify';
import { registerFeedRoutes } from './feedRoutes';
import { registerAuthRoutes } from './authRoutes';
import { registerPostRoutes } from './postRoutes';
import { registerStatsRoutes } from './statsRoutes';
import { registerProfileRoutes } from './profileRoutes';
import { registerUserRoutes } from './userRoutes';
import { registerPasskeyRoutes } from './passkeyRoutes';
import { registerSessionRoutes } from './sessionRoutes';
import { registerHealthRoutes } from './healthRoutes';

export async function registerRoutes(app: FastifyInstance) {
  await registerFeedRoutes(app);
  await registerAuthRoutes(app);
  await registerPostRoutes(app);
  await registerStatsRoutes(app);
  await registerProfileRoutes(app);
  await registerUserRoutes(app);
  await registerPasskeyRoutes(app);
  await registerSessionRoutes(app);
  await registerHealthRoutes(app);
}
