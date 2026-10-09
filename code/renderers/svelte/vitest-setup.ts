import { pathToFileURL } from 'node:url';

import { expect } from 'vitest';

import { StorybookSvelteCSFError } from './src/svelte-csf/utils/error.ts';

// Error messages contain the installed version and the absolute paths of the stories files.
// Snapshots show placeholders, so that updating them with `-u` writes no value that changes with
// each release or machine.
const replacements = [
  [`/blob/v${StorybookSvelteCSFError.packageVersion}/`, '/blob/v<version>/'],
  [pathToFileURL(process.cwd()).href, '<cwd>'],
] as const;

expect.addSnapshotSerializer({
  test: (value) =>
    value instanceof Error && replacements.some(([actual]) => value.message.includes(actual)),
  serialize: (value: Error) =>
    `[${value.name}: ${replacements.reduce(
      (message, [actual, placeholder]) => message.replaceAll(actual, placeholder),
      value.message
    )}]`,
});
