import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BASELINE_PATH } from './baseline-path.ts';

const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const BASELINES = {
  reflectedBooleanArgTypes: 'lit-basic-attributes/argtypes.snapshot',
  unionArgTypes: 'lit-union-jsdoc/argtypes.snapshot',
  eventsArgTypes: 'lit-events/argtypes.snapshot',
  argsDefaultSnippet: 'lit-basic-attributes/snippet-ArgsDefaultRender.snapshot',
  propertyOnlySnippet: 'lit-property-only/snippet-LitTemplate.snapshot',
  eventsSnippet: 'lit-events/snippet-LitTemplate.snapshot',
} as const;

const baseline = (key: keyof typeof BASELINES) =>
  readFileSync(join(fixturesDir, BASELINES[key]), 'utf-8');

test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of Object.values(BASELINES)) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('reflected booleans record one arg', () => {
    // Legacy: records both `is-open` under attributes and `isOpen` under properties.
    const text = baseline('reflectedBooleanArgTypes');
    const reflectedKeys = [/^  "is-open": \{$/m.test(text), /^  "isOpen": \{$/m.test(text)].filter(
      Boolean
    );
    expect(reflectedKeys).toHaveLength(1);
  });

  gapTest('literal unions and JSDoc tags reach argTypes structurally', () => {
    // Legacy: records the union as free text and leaves @deprecated/@default out of jsDocTags.
    expect(baseline('unionArgTypes')).toContain('"name": "enum"');
    expect(baseline('unionArgTypes')).toMatch(/"jsDocTags": [[{]/);
    expect(baseline('unionArgTypes')).toContain('deprecated');
    expect(baseline('unionArgTypes')).toContain('default');
  });

  gapTest('events carry structured type information and descriptions', () => {
    // Legacy: event argTypes use `void` as the sbType and lose structured CustomEvent detail.
    const text = baseline('eventsArgTypes');
    expect(text).not.toContain('"name": "void"');
    expect(text).not.toMatch(/^        "summary": "CustomEvent",$/m);
  });
});

describe('legacy snippet gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('default-render snippets carry args as attributes', () => {
    // Legacy: default render assigns args as properties, so the snippet is empty.
    expect(baseline('argsDefaultSnippet')).toContain('label=');
    expect(baseline('argsDefaultSnippet')).toContain('count=');
    expect(baseline('argsDefaultSnippet')).toContain('is-open');
  });

  gapTest('property-only values are represented or warned about', () => {
    // Legacy: lit property bindings do not serialize into HTML.
    expect(baseline('propertyOnlySnippet')).toMatch(/items=|config=|warning/i);
  });

  gapTest('event listeners are represented or warned about', () => {
    // Legacy: lit event listener bindings do not serialize into HTML.
    expect(baseline('eventsSnippet')).toMatch(/my-change|my-close|warning/i);
  });
});
