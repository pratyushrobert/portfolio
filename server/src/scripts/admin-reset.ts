import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { loadConfig, serverRoot } from '../config/env.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';

let pipedPasswords: string[] | null = null;

function readPipedInput(): Promise<string> {
  return new Promise((resolveValue, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => chunks.push(chunk));
    process.stdin.once('end', () => resolveValue(chunks.join('')));
    process.stdin.once('error', reject);
    process.stdin.resume();
  });
}

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    if (pipedPasswords === null) {
      pipedPasswords = (await readPipedInput()).split(/\r?\n/);
    }
    const passwords = pipedPasswords;
    process.stdout.write(prompt);
    process.stdout.write('\n');
    return passwords.shift() ?? '';
  }

  return new Promise((resolveValue, reject) => {
    let value = '';
    const input = process.stdin;

    const cleanup = () => {
      input.setRawMode?.(false);
      input.pause();
      input.removeListener('data', onData);
      input.removeListener('error', onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Password reset cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolveValue(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
    input.on('error', onError);
  });
}

async function updateLocalEnvironment(password: string): Promise<void> {
  const envPath = resolve(serverRoot, '.env');
  const current = await readFile(envPath, 'utf8');
  const serialized = `ADMIN_PASSWORD=${JSON.stringify(password)}`;
  const updated = /^ADMIN_PASSWORD=.*$/m.test(current)
    ? current.replace(/^ADMIN_PASSWORD=.*$/m, serialized)
    : `${current.trimEnd()}\n${serialized}\n`;
  await writeFile(envPath, updated, { encoding: 'utf8', mode: 0o600 });
  await chmod(envPath, 0o600);
}

async function main(): Promise<void> {
  dotenv.config({ path: resolve(serverRoot, '.env') });
  const password = await readHidden('New local admin password: ');
  const confirmation = await readHidden('Confirm new local admin password: ');

  if (password !== confirmation) {
    throw new Error('Passwords do not match');
  }
  if (password.includes('\r') || password.includes('\n')) {
    throw new Error('Password cannot contain line breaks');
  }

  // The new password replaces only the invalid/stale value for this command;
  // all other configuration remains environment-controlled.
  const config = loadConfig({ ...process.env, ADMIN_PASSWORD: password });
  await updateLocalEnvironment(password);

  const database = await initializeDatabase(config);
  await closeDatabase(database);
  console.log(`Admin password reset for ${config.ADMIN_EMAIL}.`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Admin password reset failed';
  console.error(message);
  process.exitCode = 1;
}
