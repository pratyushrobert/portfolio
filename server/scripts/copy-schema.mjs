import { copyFile } from 'node:fs/promises';

await copyFile(new URL('../src/db/schema.sql', import.meta.url), new URL('../dist/db/schema.sql', import.meta.url));
