import { loadEnvironment } from '../config/env.js';
import { closeDatabase, initializeDatabase } from './index.js';

const database = initializeDatabase(loadEnvironment());
closeDatabase(database);
console.log('MimiOS database initialized.');
