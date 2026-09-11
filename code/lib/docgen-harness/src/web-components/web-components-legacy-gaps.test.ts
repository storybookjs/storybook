// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, test, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { extractArgTypes } from '../../../../renderers/web-components/src/docs/custom-elements.ts';
import { setCustomElementsManifest } from '../../../../renderers/web-components/src/framework-api.ts';
import { BASELINE_PATH } from './baseline-path.ts';

const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

type ManifestWithSchemaVersion = { schemaVersion?: string };

const BASELINES = {
  basicArgTypes: 'lit-basic-attributes/argtypes.snapshot',
  v2ArgTypes: 'lit-basic-attributes/v2-argtypes.snapshot',
  wcaArgTypes: 'lit-basic-attributes/wca-argtypes.snapshot',
  unionArgTypes: 'lit-union-jsdoc/argtypes.snapshot',
  unionDescription: 'lit-union-jsdoc/description.snapshot',
  eventsArgTypes: 'lit-events/argtypes.snapshot',
  argsDefaultSnippet: 'lit-basic-attributes/snippet-ArgsDefaultRender.snapshot',
  propertyOnlySnippet: 'lit-property-only/snippet-LitTemplate.snapshot',
  eventsSnippet: 'lit-events/snippet-LitTemplate.snapshot',
  backSideSnippet: 'demo-wc-card/snippet-Back.snapshot',
} as const;

const baseline = (key: keyof typeof BASELINES) =>
  readFileSync(join(fixturesDir, BASELINES[key]), 'utf-8');

const readManifest = (fileName: string): ManifestWithSchemaVersion =>
  JSON.parse(readFileSync(join(fixturesDir, 'lit-basic-attributes', fileName), 'utf-8'));

afterEach(() => {
  vi.restoreAllMocks();
  setCustomElementsManifest(undefined);
});

test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of Object.values(BASELINES)) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('reflected booleans record one arg', () => {
    // Legacy: records both `is-open` under attributes and `isOpen` under properties.
    const text = baseline('basicArgTypes');
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

  gapTest('@summary reaches the component description', () => {
    // Legacy: the manifest records @summary separately and the runtime reads only description.
    expect(baseline('unionDescription')).toContain('Compact variant fixture.');
  });

  // The manifest records deprecated on the declaration and the runtime reads only description.
  gapTest('class-level @deprecated reaches the component description', () => {
    expect(baseline('unionDescription')).toContain('Use lit-basic-attributes instead.');
  });

  gapTest('events carry structured type information and descriptions', () => {
    // Legacy: event argTypes use `void` as the sbType and lose structured CustomEvent detail.
    const text = baseline('eventsArgTypes');
    expect(text).not.toContain('"name": "void"');
    expect(text).not.toMatch(/^        "summary": "CustomEvent",$/m);
  });

  gapTest('CEM 2.1.0 CSS states are recorded', () => {
    // Legacy: cssStates is not mapped at all.
    expect(baseline('v2ArgTypes')).toContain('  "open": {');
  });

  gapTest('the WCA experimental shape triggers a deprecation warning', async () => {
    // Legacy: the shape is accepted silently.
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    setCustomElementsManifest(readManifest('custom-elements.wca.json'));
    extractArgTypes('lit-basic-attributes');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/deprecat/i));
    setCustomElementsManifest(undefined);
  });
});

describe('manifest shape regressions', () => {
  test('the 1.0.0 and 2.1.0 captures record the same argTypes today', () => {
    expect(baseline('v2ArgTypes')).toBe(baseline('basicArgTypes'));
  });

  it.each([
    [
      'missing schemaVersion',
      (manifest: ManifestWithSchemaVersion) => delete manifest.schemaVersion,
    ],
    [
      'unknown schemaVersion',
      (manifest: ManifestWithSchemaVersion) => (manifest.schemaVersion = '99.0.0'),
    ],
  ])('schemaVersion is not read by the runtime: %s', async (_label, mutateManifest) => {
    const manifest = readManifest('custom-elements.json');
    setCustomElementsManifest(manifest);
    const expected = extractArgTypes('lit-basic-attributes');

    const variantManifest = readManifest('custom-elements.json');
    mutateManifest(variantManifest);
    setCustomElementsManifest(variantManifest);

    expect(extractArgTypes('lit-basic-attributes')).toEqual(expected);
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

  gapTest('reflected Lit attributes are visible after property binding', () => {
    // Legacy reads innerHTML before Lit reflects `.backSide=${true}` to `back-side`.
    expect(baseline('backSideSnippet')).toContain('back-side');
  });
});
