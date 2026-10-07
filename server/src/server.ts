import { loadEnvironment } from './config/env.js';
import { buildApp } from './app.js';
import { closeDatabase, initializeDatabase } from './db/index.js';

const env = loadEnvironment();
const database = initializeDatabase(env);
let app: Awaited<ReturnType<typeof buildApp>>;
try {
  app = await buildApp({ database, config: env });
} catch (error) {
  closeDatabase(database);
  throw error;
}

const shutdown = async (): Promise<void> => {
  await app.close();
  closeDatabase(database);
};

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`MimiOS server listening on port ${env.PORT}`);
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exit(1);
}
