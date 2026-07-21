import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BASELINE_PATH } from './baseline-path.ts';

// Red markers for the closeable legacy docgen gaps listed in the README, asserted directly
// against the committed baseline snapshot text (the pretty-format embeds unescaped quotes
// and cannot be parsed). While BASELINE_PATH is 'legacy' each marker is an expected
// failure; flipping it hardens every marker into a plain requirement on the re-recorded
// baselines. Accepted deltas (static snippets drop event handlers and function args) and
// type-level friction (the props-generic @ts-expect-error) have no markers.
const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const BASELINES = {
  unionArgTypes: 'props-union-enum/argtypes.snapshot',
  basicTypesArgTypes: 'props-basic-types/argtypes.snapshot',
  genericArgTypes: 'props-generic/argtypes.snapshot',
  intersectionArgTypes: 'type-intersection/argtypes.snapshot',
  destructuredArgTypes: 'define-props-destructured/argtypes.snapshot',
  jsdocArgTypes: 'jsdoc-tags/argtypes.snapshot',
  pickArgTypes: 'cross-file-composed-utility/argtypes.snapshot',
  vModelArgTypes: 'v-model/argtypes.snapshot',
  vModelSnippet: 'v-model/snippet-VModelBinding.snapshot',
  bigintSnippet: 'props-basic-types/snippet-UnrepresentableArgs.snapshot',
} as const;

const baseline = (key: keyof typeof BASELINES) =>
  readFileSync(join(fixturesDir, BASELINES[key]), 'utf-8');

// Guards the markers below: a missing snapshot would throw inside a test.fails body and
// silently masquerade as the expected failure.
test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of Object.values(BASELINES)) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('literal-string unions are recorded as an enum sbType', () => {
    // Legacy: sbType `union` whose elements are `other` values with embedded quotes.
    expect(baseline('unionArgTypes')).toContain('"name": "enum"');
  });

  gapTest('array-typed props are recorded with a structured array sbType', () => {
    // Legacy: the shared convert() helper stringifies to `Array([object Object])`.
    expect(baseline('basicTypesArgTypes')).toContain('"name": "array"');
    expect(baseline('genericArgTypes')).toContain('"name": "array"');
  });

  gapTest('intersection-typed props are recorded with a structured intersection sbType', () => {
    // Legacy: `intersection([object Object],[object Object])` from the same convert() bug.
    expect(baseline('intersectionArgTypes')).toContain('"name": "intersection"');
  });

  gapTest('reactive-props-destructure defaults are recorded', () => {
    // Legacy: only the withDefaults() call pattern is extracted; the inline destructured
    // default is invisible, so `size` records `"defaultValue": undefined`.
    expect(baseline('destructuredArgTypes')).toMatch(/"defaultValue": \{[^}]*medium/);
  });

  gapTest('prop JSDoc tags are recorded in table.jsDocTags', () => {
    // Legacy: vue-docgen-api splits tags into a separate `tags` object that the
    // description-parsing pipeline never reads, so jsDocTags stays undefined.
    expect(baseline('jsdocArgTypes')).toMatch(/"jsDocTags": [[{]/);
  });

  gapTest('Pick-composed props are resolved', () => {
    // Legacy: the whole `props` section is absent, so the recorded argTypes are `{}`.
    expect(baseline('pickArgTypes')).toContain('"label"');
  });

  gapTest('defineModel named models surface as prop and update event', () => {
    // Legacy: `defineModel('checked')` is entirely invisible - no prop, no event.
    expect(baseline('vModelArgTypes')).toContain('"checked"');
    expect(baseline('vModelArgTypes')).toContain('"update:checked"');
  });
});

describe('legacy snippet gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('named models render as a v-model:checked binding', () => {
    // Legacy: docgen blindness to defineModel yields a bare `checked` attribute.
    expect(baseline('vModelSnippet')).toContain('v-model:checked=');
  });

  gapTest('bigint args beyond MAX_SAFE_INTEGER round-trip exactly', () => {
    // Legacy: `BigInt(9007199254740993)` embeds bare digits that are truncated as a JS
    // number before the BigInt is constructed, yielding a different value than the story.
    expect(baseline('bigintSnippet')).toMatch(
      /9007199254740993n|BigInt\(["']9007199254740993["']\)/
    );
  });
});
