import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { extractArgTypes } from '../../../../renderers/svelte/src/extractArgTypes.ts';
import { svelteSnippetGrammar } from '../compare/snippets-svelte.ts';
import { BASELINE_PATH } from './baseline-path.ts';

const gapTest = BASELINE_PATH === 'legacy' ? test.fails : test;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const BASELINES = {
  basicDescription: 'runes-basic-props/description.snapshot',
  basicStoryDescriptions: 'runes-basic-props/story-descriptions.snapshot',
  unionArgTypes: 'runes-union-literal/argtypes.snapshot',
  snippetsArgTypes: 'runes-snippets/argtypes.snapshot',
  jsdocArgTypes: 'runes-jsdoc-tags/argtypes.snapshot',
  templateReferenceSnippet: 'runes-basic-props/snippet-TemplateReference.snapshot',
  defaultSnippet: 'runes-basic-props/snippet-Default.snapshot',
  bindableRestArgTypes: 'runes-bindable-rest/argtypes.snapshot',
  complexArgTypes: 'runes-complex-types/argtypes.snapshot',
  basicSvelteSnippet: 'runes-basic-props/snippet-Default.snapshot',
  basicPlainSnippet: 'runes-basic-props/plain-csf-snippet-Default.snapshot',
  callbacksSvelteSnippet: 'runes-callbacks/snippet-Default.snapshot',
  callbacksPlainSnippet: 'runes-callbacks/plain-csf-snippet-Default.snapshot',
} as const;

const baseline = (key: keyof typeof BASELINES) =>
  readFileSync(join(fixturesDir, BASELINES[key]), 'utf-8');

test('every baseline referenced by a red marker exists', () => {
  for (const relativePath of Object.values(BASELINES)) {
    expect(existsSync(join(fixturesDir, relativePath)), relativePath).toBe(true);
  }
});

describe('legacy argTypes gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('component description reaches the component description snapshot', () => {
    expect(baseline('basicDescription')).toContain('Panel with string, number and boolean props.');
  });

  gapTest('literal-string unions are recorded as an enum sbType', () => {
    expect(baseline('unionArgTypes')).toContain('"name": "enum"');
  });

  gapTest('snippet-typed props are recorded under the slots category', () => {
    expect(baseline('snippetsArgTypes')).toContain('"category": "slots"');
    expect(baseline('snippetsArgTypes')).toContain('"slot_header"');
  });

  gapTest('prop JSDoc tags are recorded in table.jsDocTags', () => {
    const snapshot = baseline('jsdocArgTypes');
    expect(snapshot).toMatch(/"jsDocTags": \{[\s\S]*?"deprecated"/);
    expect(snapshot).toMatch(/"jsDocTags": \{[\s\S]*?"default"/);
  });
});

describe('legacy snippet gaps (red until a re-recorded baseline closes them)', () => {
  gapTest('text-content args references are emitted without JSON quotes', () => {
    expect(baseline('templateReferenceSnippet')).toContain('<h1>Reference title</h1>');
  });

  gapTest('spread args omit values equal to prop defaults', () => {
    expect(baseline('defaultSnippet')).not.toContain('count={0}');
    expect(baseline('defaultSnippet')).not.toContain('primary={false}');
  });
});

describe('legacy behavior locked by the current recordings', () => {
  test('intrinsic HTML attributes inherited via HTMLInputAttributes are not recorded', () => {
    expect(baseline('bindableRestArgTypes')).not.toContain('"disabled"');
    expect(baseline('bindableRestArgTypes')).not.toContain('"placeholder"');
  });

  test('props typed through an imported interface are recorded', () => {
    expect(baseline('complexArgTypes')).toContain('"config"');
    expect(baseline('complexArgTypes')).toContain('PanelConfig');
  });

  test('a component without docgen yields empty argTypes', () => {
    expect(extractArgTypes({} as Parameters<typeof extractArgTypes>[0])).toEqual({});
  });

  test('equivalent plain CSF and Svelte CSF stories represent the same attribute names', () => {
    expect(namesOf(baseline('basicSvelteSnippet'))).toEqual(namesOf(baseline('basicPlainSnippet')));
  });

  test('Svelte CSF and plain CSF record function args with their current mock spellings', () => {
    expect(baseline('callbacksSvelteSnippet')).toContain('onclick={onclick}');
    expect(baseline('callbacksPlainSnippet')).toContain('onclick={<handler>}');
  });

  test('Svelte CSF comments populate docs description parameters', () => {
    const snapshot = baseline('basicStoryDescriptions');
    expect(snapshot).toContain('Panel fixture component description.');
    expect(snapshot).toContain('Default story docs description.');
    expect(snapshot).toContain('"AllArgs": undefined');
  });
});

function namesOf(snippet: string): string[] {
  const parsed = svelteSnippetGrammar.parse(snippet);
  expect(parsed, snippet).toBeDefined();
  return [...svelteSnippetGrammar.representedNames(parsed!)].sort();
}
