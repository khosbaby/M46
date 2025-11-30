import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';
import { ENV } from './env';

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: ENV.FRONTEND_ORIGINS,
    credentials: true,
  });

  await registerRoutes(app);

  try {
    await app.listen({ port: ENV.PORT, host: ENV.HOST });
    console.log(`Backend API ready on http://${ENV.HOST}:${ENV.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
