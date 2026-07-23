import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

import * as reactPreset from '../../../renderers/react/src/preset.ts';

// Green control for the vue3/angular provider-seam files: the same assertion bodies
// their test.fails markers use (kept byte-parallel on purpose - copied, not shared)
// pass here against React's registered providers, proving a provider landing on a red
// surface forces the flip.

const presetModules: Record<string, Record<string, unknown>> = {
  'renderers/react': reactPreset,
};

test('the preset modules asserted by the markers resolve', () => {
  for (const [name, ns] of Object.entries(presetModules)) {
    expect(ns, name).toBeTypeOf('object');
    expect(Object.keys(ns).length, name).toBeGreaterThan(0);
  }
});

test('react: docgen provider registered', async () => {
  const value = Object.values(presetModules)
    .map((ns) => ns.experimental_docgenProvider)
    .find((v) => v !== undefined);
  expect(value).toBeDefined();
  const applied = (typeof value === 'function' ? await value([]) : value) as {
    moduleSpecifier: string;
  }[];
  expect(applied.length).toBeGreaterThanOrEqual(1);
  expect(isAbsolute(applied[0].moduleSpecifier)).toBe(true);
  expect(existsSync(applied[0].moduleSpecifier)).toBe(true);
});

test('react: story-docs provider registered', () => {
  const value = Object.values(presetModules)
    .map((ns) => ns.experimental_storyDocsProvider)
    .find((v) => v !== undefined);
  expect(value).toBeDefined();
  expect(value).toBeTypeOf('function');
});
