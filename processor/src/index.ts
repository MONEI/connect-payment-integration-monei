import Fastify from 'fastify';
import { registerRoutes } from './routes';

const app = Fastify({
  logger: true,
  disableRequestLogging: false,
});

async function start(): Promise<void> {
  try {
    // Register all routes
    await registerRoutes(app);

    // Start server
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`MONEI Payment Processor running on ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();

export { app };
