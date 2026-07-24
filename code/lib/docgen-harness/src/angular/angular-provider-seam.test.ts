import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

import * as angularVitePreset from '../../../../frameworks/angular-vite/src/preset.ts';

// Bare test.fails seam markers: red while no OSA provider is registered on the
// angular-vite preset surface (the Angular slice is scoped to angular-vite only). A
// qualifying provider export makes vitest fail a marker "expected to fail but passed";
// the flip to a plain test is the definition-of-done signal. Unlike the gap markers
// these are independent of BASELINE_PATH: they flip on provider registration.

const presetModules: Record<string, Record<string, unknown>> = {
  'frameworks/angular-vite': angularVitePreset,
};

// Guards the markers below: the preset imports are static, so a moved module fails
// collection loudly, but a module that still resolves while losing its exports would
// keep the markers red on the key-absent assertion and masquerade as the expected
// failure - this pins the namespaces as real, non-empty objects.
test('the preset modules asserted by the markers resolve', () => {
  for (const [name, ns] of Object.entries(presetModules)) {
    expect(ns, name).toBeTypeOf('object');
    expect(Object.keys(ns).length, name).toBeGreaterThan(0);
  }
});

test.fails('angular: docgen provider registered', async () => {
  // Applying every asserted module and requiring a real on-disk worker module keeps
  // the flip honest in both directions: a stub export (empty array, dangling
  // descriptor, or a value that cannot be applied cold) neither flips the marker nor
  // masks a qualifying provider registered on another asserted module.
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

test.fails('angular: story-docs provider registered', () => {
  // The value form and the reducer form are both functions and cannot be told apart
  // without invoking with real Options, which no cold test fabricates - the flip edit
  // adds the behavioral assertion against the real provider. Every asserted module is
  // checked so a non-function stub cannot mask a real provider on another one.
  const values = Object.values(presetModules)
    .map((ns) => ns.experimental_storyDocsProvider)
    .filter((v) => v !== undefined);
  expect(values.some((v) => typeof v === 'function')).toBe(true);
});
