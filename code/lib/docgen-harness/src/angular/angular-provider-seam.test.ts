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

// Guards the markers below: a moved or broken preset module would throw inside a
// test.fails body and silently masquerade as the expected failure.
test('the preset modules asserted by the markers resolve', () => {
  for (const [name, ns] of Object.entries(presetModules)) {
    expect(ns, name).toBeTypeOf('object');
    expect(Object.keys(ns).length, name).toBeGreaterThan(0);
  }
});

test.fails('angular: docgen provider registered', async () => {
  // Applying the preset value and requiring a real on-disk worker module stops a stub
  // export (empty array or dangling descriptor) from flipping this marker.
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

test.fails('angular: story-docs provider registered', () => {
  // The value form and the reducer form are both functions and cannot be told apart
  // without invoking with real Options, which no cold test fabricates - the flip edit
  // adds the behavioral assertion against the real provider.
  const value = Object.values(presetModules)
    .map((ns) => ns.experimental_storyDocsProvider)
    .find((v) => v !== undefined);
  expect(value).toBeDefined();
  expect(value).toBeTypeOf('function');
});
