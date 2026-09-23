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
const OSA_CLOSED = new Set<string>();

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

type ManifestWithSchemaVersion = { schemaVersion?: string };

const BASELINES = (prefix: '' | 'osa-') =>
  ({
    basicArgTypes: `lit-basic-attributes/${prefix}argtypes.snapshot`,
    v2ArgTypes: `lit-basic-attributes/${prefix}v2-argtypes.snapshot`,
    unionArgTypes: `lit-union-jsdoc/${prefix}argtypes.snapshot`,
    unionDescription: `lit-union-jsdoc/${prefix}description.snapshot`,
    eventsArgTypes: `lit-events/${prefix}argtypes.snapshot`,
  }) as const;

const FIXED = {
  argsDefaultSnippet: 'lit-basic-attributes/snippet-ArgsDefaultRender.snapshot',
  propertyOnlySnippet: 'lit-property-only/snippet-LitTemplate.snapshot',
  eventsSnippet: 'lit-events/snippet-LitTemplate.snapshot',
  backSideSnippet: 'demo-wc-card/snippet-Back.snapshot',
  basicPayload: 'lit-basic-attributes/osa-payload.snapshot',
  unionPayload: 'lit-union-jsdoc/osa-payload.snapshot',
} as const;

type ComparedBaseline = keyof ReturnType<typeof BASELINES>;
type FixedBaseline = keyof typeof FIXED;

const read = (relativePath: string) => readFileSync(join(fixturesDir, relativePath), 'utf-8');

const baseline = (key: ComparedBaseline, prefix: '' | 'osa-' = '') => read(BASELINES(prefix)[key]);

const fixedBaseline = (key: FixedBaseline) => read(FIXED[key]);

const osaGapTest = (name: string) => (OSA_CLOSED.has(name) ? test : test.fails);

function marker(
  name: string,
  assertion: (readBaseline: (key: ComparedBaseline) => string) => void
) {
  gapTest(`${name} (legacy)`, () => assertion((key) => baseline(key)));
  osaGapTest(name)(`${name} (osa)`, () => assertion((key) => baseline(key, 'osa-')));
}

const readManifest = (fileName: string): ManifestWithSchemaVersion =>
  JSON.parse(readFileSync(join(fixturesDir, 'lit-basic-attributes', fileName), 'utf-8'));

afterEach(() => {
  vi.restoreAllMocks();
  setCustomElementsManifest(undefined);
});

test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of [
    ...Object.values(BASELINES('')),
    ...Object.values(BASELINES('osa-')),
    ...Object.values(FIXED),
  ]) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  marker('reflected booleans record one arg', (readBaseline) => {
    const text = readBaseline('basicArgTypes');
    const reflectedKeys = [/^  "is-open": \{$/m.test(text), /^  "isOpen": \{$/m.test(text)].filter(
      Boolean
    );
    expect(reflectedKeys).toHaveLength(1);
  });

  marker('literal unions and JSDoc tags reach argTypes structurally', (readBaseline) => {
    expect(readBaseline('unionArgTypes')).toContain('"name": "enum"');
    expect(readBaseline('unionArgTypes')).toMatch(/"jsDocTags": [[{]/);
    expect(readBaseline('unionArgTypes')).toContain('deprecated');
    expect(readBaseline('unionArgTypes')).toContain('default');
  });

  marker('@summary reaches the component description', (readBaseline) => {
    expect(readBaseline('unionDescription')).toContain('Compact variant fixture.');
  });

  marker('class-level @deprecated reaches the component description', (readBaseline) => {
    expect(readBaseline('unionDescription')).toContain('Use lit-basic-attributes instead.');
  });

  marker('events carry structured type information and descriptions', (readBaseline) => {
    const text = readBaseline('eventsArgTypes');
    expect(text).not.toContain('"name": "void"');
    expect(text).not.toMatch(/^        "summary": "CustomEvent",$/m);
  });

  marker('CEM 2.1.0 CSS states are recorded', (readBaseline) => {
    expect(readBaseline('v2ArgTypes')).toContain('  "open": {');
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

describe('OSA payload gaps (red until the server mapper closes them)', () => {
  const componentTagsName = 'component-level jsDocTags carry the CEM deprecated and summary fields';

  osaGapTest(componentTagsName)(componentTagsName, () => {
    const payload = fixedBaseline('unionPayload');
    expect(payload).not.toContain('"jsDocTags": {}');
    expect(payload).toMatch(/"deprecated": \[\s*"Use lit-basic-attributes instead\."/);
    expect(payload).toMatch(/"summary": \[\s*"Compact variant fixture\."/);
  });

  const storyMetaName = 'the story meta docblock reaches the payload description and jsDocTags';

  osaGapTest(storyMetaName)(storyMetaName, () => {
    const payload = fixedBaseline('basicPayload');
    expect(payload).toContain(
      '"description": "Story-level docs for the basic attributes fixture."'
    );
    expect(payload).toMatch(/"since": \[\s*"1\.2\.0"/);
    expect(payload).toMatch(/"see": \[\s*"https:\/\/example\.com\/lit-basic-attributes"/);
  });
});

describe('manifest shape regressions', () => {
  test('the 1.0.0 and 2.1.0 captures record the same argTypes today', () => {
    expect(baseline('v2ArgTypes')).toBe(baseline('basicArgTypes'));
  });

  test('the OSA 1.0.0 and 2.1.0 lit-basic-attributes argTypes recordings are byte-identical', () => {
    expect(baseline('v2ArgTypes', 'osa-')).toBe(baseline('basicArgTypes', 'osa-'));
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
    expect(fixedBaseline('argsDefaultSnippet')).toContain('label=');
    expect(fixedBaseline('argsDefaultSnippet')).toContain('count=');
    expect(fixedBaseline('argsDefaultSnippet')).toContain('is-open');
  });

  gapTest('property-only values are represented or warned about', () => {
    expect(fixedBaseline('propertyOnlySnippet')).toMatch(/items=|config=|warning/i);
  });

  gapTest('event listeners are represented or warned about', () => {
    expect(fixedBaseline('eventsSnippet')).toMatch(/my-change|my-close|warning/i);
  });

  gapTest('reflected Lit attributes are visible after property binding', () => {
    expect(fixedBaseline('backSideSnippet')).toContain('back-side');
  });
});
