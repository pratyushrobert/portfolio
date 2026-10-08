import { loadEnvironment } from './config/env.js';
import { buildApp } from './app.js';
import { closeDatabase, initializeDatabase } from './db/index.js';

const env = loadEnvironment();
const database = await initializeDatabase(env);
let app: Awaited<ReturnType<typeof buildApp>>;
try {
  app = await buildApp({ database, config: env });
} catch (error) {
  await closeDatabase(database);
  throw error;
}

const shutdown = async (): Promise<void> => {
  await app.close();
  await closeDatabase(database);
};

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

try {
  const host = env.HOST || '0.0.0.0';
  const port = env.PORT || 3001;
  await app.listen({ host, port });
  app.log.info(`MimiOS server listening on ${host}:${port}`);
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exit(1);
}
