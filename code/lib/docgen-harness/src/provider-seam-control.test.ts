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
  const descriptors: unknown[] = [];
  for (const ns of Object.values(presetModules)) {
    const value = ns.experimental_docgenProvider;
    if (value === undefined) {
      continue;
    }
    try {
      const applied = typeof value === 'function' ? await value([]) : value;
      if (Array.isArray(applied)) {
        descriptors.push(...applied);
      }
    } catch {
      // A cold apply carries no real Options; a value that throws does not register.
    }
  }
  const qualifying = descriptors.filter(
    (d) =>
      typeof d === 'object' &&
      d !== null &&
      'moduleSpecifier' in d &&
      typeof d.moduleSpecifier === 'string' &&
      isAbsolute(d.moduleSpecifier) &&
      existsSync(d.moduleSpecifier)
  );
  expect(qualifying.length).toBeGreaterThanOrEqual(1);
});

test('react: story-docs provider registered', () => {
  const values = Object.values(presetModules)
    .map((ns) => ns.experimental_storyDocsProvider)
    .filter((v) => v !== undefined);
  expect(values.some((v) => typeof v === 'function')).toBe(true);
});
