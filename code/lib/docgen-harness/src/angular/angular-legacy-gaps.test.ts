import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BASELINE_PATH } from './baseline-path.ts';

const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const BASELINES = {
  ioBasicsArgTypes: 'decorator-io-basics/argtypes.snapshot',
  expressionDefaultsArgTypes: 'expression-defaults/argtypes.snapshot',
  jsdocArgTypes: 'jsdoc-tags/argtypes.snapshot',
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
  gapTest('TS-optional decorator inputs are recorded as not required', () => {
    // #28706 - legacy: compodoc never emits `optional` for decorator inputsClass
    // entries, so `required: !item.optional` is true across the board. Only `count`
    // is TS-optional in the fixture, so the required:false must sit inside its block
    // (before the alphabetically-next `data` entry) - a fix elsewhere must not close
    // this marker.
    expect(baseline('ioBasicsArgTypes')).toMatch(
      /"count": \{(?:(?!"data": \{)[^])*"required": false/
    );
  });

  gapTest('numeric inputs never record an invented NaN default', () => {
    // Legacy: `castDefaultValue` runs `Number(undefined)` for a number-typed input
    // without a literal default (`count`), and `Number('5 * 60 * 1000')` for an
    // expression default (`timeoutMs`) - both record `NaN`. Both files must be
    // NaN-free; a fix for only one path must not close this marker.
    expect(baseline('ioBasicsArgTypes')).not.toContain('NaN');
    expect(baseline('expressionDefaultsArgTypes')).not.toContain('NaN');
  });

  gapTest('prop JSDoc tags are recorded in table.jsDocTags', () => {
    // #28506 - legacy: tag names and values never reach argTypes as structured data
    // (`@deprecated` vanishes entirely; `@see`/custom tag text leaks into the
    // description prose instead).
    expect(baseline('jsdocArgTypes')).toContain('"jsDocTags"');
    expect(baseline('jsdocArgTypes')).toContain('deprecated');
  });

  gapTest('function-typed inputs get a structured function sbType', () => {
    // Legacy: compodoc's bare `function` type string falls through the enum
    // resolution into `{ name: 'other', value: 'empty-enum' }`.
    expect(baseline('ioBasicsArgTypes')).toContain('"name": "function"');
  });

  gapTest('@default tag values are extracted clean', () => {
    // Legacy: the DOMParser extraction keeps the surrounding quotes and the trailing
    // newline of the JSDoc comment (`'steelblue'\n`).
    expect(baseline('jsdocArgTypes')).toContain('"summary": "steelblue"');
  });
});

// Snippet-side deltas (bindings-only templates, no ng-content, no banana-in-a-box for
// model(), raw interpolation of functions and undefined) are Story 4.6's documented v1
// scope, not closeable gaps - they deliberately carry no markers.
