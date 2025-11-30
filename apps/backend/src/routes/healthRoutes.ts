import { FastifyInstance } from 'fastify';
import { ENV } from '../env';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'm46-backend',
      supabaseUrl: ENV.SUPABASE_URL,
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
