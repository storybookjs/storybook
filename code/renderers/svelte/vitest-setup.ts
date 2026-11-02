import { pathToFileURL } from 'node:url';

import rendererPkg from '@storybook/svelte/package.json' with { type: 'json' };
import { expect } from 'vitest';

// Error messages contain the installed version and the absolute paths of the stories files.
// Snapshots show placeholders, so that updating them with `-u` writes no value that changes with
// each release or machine.
const replacements = [
  [`/blob/v${rendererPkg.version}/`, '/blob/v<version>/'],
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
