import { loadEnvironment } from '../config/env.js';
import { closeDatabase, initializeDatabase } from './index.js';

const database = await initializeDatabase(loadEnvironment());
await closeDatabase(database);
console.log('MimiOS database initialized.');
