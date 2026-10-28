import { createRequire } from 'node:module';
import { join } from 'node:path';

// Installations older than `@storybook/open-service` only ship the `storybook` entry.
const CHILD_HOST_ENTRIES = [
  '@storybook/open-service/child-host',
  'storybook/internal/tools/child-host',
];

export function resolveChildHostScript(resolutionRoot: string): string {
  const rootRequire = createRequire(join(resolutionRoot, 'package.json'));
  let failure: unknown;
  for (const entry of CHILD_HOST_ENTRIES) {
    try {
      return rootRequire.resolve(entry, { paths: [resolutionRoot] });
    } catch (error) {
      failure ??= error;
    }
  }
  throw failure;
}
