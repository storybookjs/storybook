import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { glob } from 'tinyglobby';
import { expect, it } from 'vitest';

import { buildEntries } from './entry-configs.ts';

const CODE_DIR = join(import.meta.dirname, '..', '..', 'code');

it('registers the build-config.ts next to each package.json under its package name', async () => {
  const configPaths = await glob('**/build-config.ts', {
    cwd: CODE_DIR,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  const configsByName = new Map<string, unknown>();
  for (const configPath of configPaths) {
    const { name } = JSON.parse(await readFile(join(dirname(configPath), 'package.json'), 'utf8'));
    configsByName.set(name, (await import(pathToFileURL(configPath).href)).default);
  }

  expect([...configsByName.keys()].sort()).toEqual(Object.keys(buildEntries).sort());
  for (const [name, config] of configsByName) {
    expect(config, name).toBe(buildEntries[name as keyof typeof buildEntries]);
  }
});
