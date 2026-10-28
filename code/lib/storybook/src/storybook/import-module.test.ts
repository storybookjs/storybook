import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { importModule } from '@storybook/core/internal/deep/utils/module';

// A built native entry, which the shared Vitest config leaves to Node rather than the module runner.
const FRAMEWORK_NODE_ENTRY = fileURLToPath(
  new URL('dist/node/index.js', import.meta.resolve('@storybook/react-vite/package.json'))
);

/** Node's own loader; the test runner does not hook `require`, which shares Node's ESM cache. */
const nodeRequire = createRequire(import.meta.url);

describe('importModule of built package files', () => {
  // Runs first: the entry must still be evaluating while the later imports arrive.
  it('returns complete exports to imports made while the module is evaluating', async () => {
    let settled = false;
    const first = importModule(FRAMEWORK_NODE_ENTRY).finally(() => {
      settled = true;
    });
    const late: Promise<string>[] = [];
    while (!settled) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      late.push(importModule(FRAMEWORK_NODE_ENTRY).then((factory) => typeof factory));
    }
    await first;

    expect(late.length).toBeGreaterThan(0);
    expect(new Set(await Promise.all(late))).toEqual(new Set(['function']));
  });

  it.each([{ name: 'framework node entry', path: FRAMEWORK_NODE_ENTRY }])(
    'loads the $name through Node, not the test module runner',
    async ({ path }) => {
      expect(await importModule(path)).toBe(nodeRequire(path).default);
    }
  );
});
