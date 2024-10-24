import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { dedent } from 'ts-dedent';

export const write = async (location: string, data: string) => {
  if (!existsSync(location)) {
    const directory = dirname(location);
    await mkdir(directory, { recursive: true });
  }
  return writeFile(location, data);
};

export const mapCoreExportToSelf = (map: string | Record<string, string>) => {
  if (typeof map === 'string') {
    return map.replace('./dist/', './core/');
  }
  return Object.entries(map).reduce<Record<string, string>>((acc, [key, input]) => {
    const value = input.replace('./dist/', './core/');
    acc[key] = value;

    return acc;
  }, {});
};

export const generateMapperContent = (input: string) => {
  const value = input
    .replace('./core/', '')
    .replace('.node', '')
    .replace('/index', '')
    .replace('.cjs', '')
    .replace('.d.ts', '')
    .replace('.mjs', '')
    .replace('.js', '');
  if (input.endsWith('.js')) {
    return `export * from '@storybook/core/${value}';\n`;
  }
  // if (input.endsWith('.cjs')) {
  //   return `module.exports = require('@storybook/core/${value}');\n`;
  // }
  if (input.endsWith('.d.ts')) {
    return dedent`
      export * from '@storybook/core/${value}';
      export type * from '@storybook/core/${value}';\n
    `;
  }
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  throw new Error(`Unexpected input: ${input}`);
};
