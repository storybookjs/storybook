// @vitest-environment happy-dom
// happy-dom provides the DOMParser that compodoc.ts instantiates for @default JSDoc tags.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

// compodoc.ts destructures FEATURES from the global once at first import, so the stub
// must exist before that import evaluates; only property mutation on this reference is
// live afterwards (the precedent test's direct globalThis assignment is banned).
const flags = vi.hoisted(() => {
  const f = { angularFilterNonInputControls: false };
  vi.stubGlobal('FEATURES', f);
  return f;
});

import {
  extractArgTypes,
  setCompodocJson,
} from '../../../../frameworks/angular-vite/src/client/compodoc.ts';
import { computesTemplateSourceFromComponent } from '../../../../frameworks/angular-vite/src/client/renderer/ComputesTemplateFromComponent.ts';
import { getComponentInputsOutputs } from '../../../../frameworks/angular-vite/src/client/renderer/utils/NgComponentAnalyzer.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'angular-baselines.test.ts records the legacy Compodoc client path; update the recorder or baseline-path.ts'
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Under `vitest -u` a match call may legitimately rewrite its file (an accepted improvement),
// so parsed-committed vs live divergence is the comparator's verdict there, not parser
// infidelity; the round-trip proof re-arms on the next normal run against the new text.
// Reads the worker config to share one mechanism with the Vue recorder, where
// `expect.getState().snapshotState` is unreachable (its production imports load
// storybook/test, which replaces the global expect instance the runner attaches per-test
// state to). If the worker global ever disappears, the guard degrades to running the
// round-trip everywhere - loud under -u, never silently weaker.
const snapshotsRewriteOnMismatch = (): boolean =>
  (
    (globalThis as unknown as Record<string, unknown>).__vitest_worker__ as
      | { config?: { snapshotOptions?: { updateSnapshot?: string } } }
      | undefined
  )?.config?.snapshotOptions?.updateSnapshot === 'all';

type AotCmp = {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
};

describe('angular legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const dirFiles = readdirSync(testDir);
    expect(dirFiles.filter((file) => file === `${fixtureCase}.component.ts`)).toHaveLength(1);

    setCompodocJson(JSON.parse(readFileSync(join(testDir, 'compodoc-input.json'), 'utf8')));

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;
    const component = meta.component;

    if (existsSync(join(testDir, 'aot-cmp.ts'))) {
      // Signal fixture: bare JIT leaves ɵcmp.inputs/outputs empty, which would record
      // `<tag></tag>` harness artifacts instead of legacy truth. Replace ɵcmp wholesale
      // with the committed AOT-shaped fragment (defineProperty, because the JIT decorator
      // installs a getter), then assert the production reader sees its members so a
      // broken attach fails loudly instead of recording silently.
      const { aotCmp } = (await import(`./__testfixtures__/${fixtureCase}/aot-cmp.ts`)) as {
        aotCmp: AotCmp;
      };
      Object.defineProperty(component, 'ɵcmp', { value: aotCmp, configurable: true });

      const { inputs, outputs } = getComponentInputsOutputs(component);
      for (const [templateName, [propName]] of Object.entries(aotCmp.inputs)) {
        expect(inputs).toContainEqual({ propName, templateName });
      }
      for (const [templateName, propName] of Object.entries(aotCmp.outputs)) {
        expect(outputs).toContainEqual({ propName, templateName });
      }
    }

    // extractArgTypes declares the compodoc-JSON-shaped Component | Directive parameter;
    // production passes the real class through an untyped parameters slot, so the
    // recorder needs a call-site cast. The uncast class stays correct for the snippet
    // call (Type<unknown> accepts it structurally).
    const asCompodocRef = component as unknown as Parameters<typeof extractArgTypes>[0];

    // Committed baselines are read BEFORE their toMatchFileSnapshot call: under -u the
    // match call rewrites the file first, and a read placed after it would compare the
    // candidate against itself, masking regressions exactly at flip re-record time. A
    // missing file is a fresh fixture's first record and skips the comparator.
    flags.angularFilterNonInputControls = false;
    const argTypesPath = join(testDir, 'argtypes.snapshot');
    const committedArgTypes = existsSync(argTypesPath)
      ? readFileSync(argTypesPath, 'utf8')
      : undefined;
    const argTypes = extractArgTypes(asCompodocRef);
    await expect(argTypes).toMatchFileSnapshot(argTypesPath);
    if (committedArgTypes !== undefined) {
      const parsed = parseArgTypesSnapshot(committedArgTypes, `${fixtureCase}/argtypes.snapshot`);
      if (!snapshotsRewriteOnMismatch()) {
        // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
        expect(parsed).toEqual(argTypes);
      }
      expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate: argTypes! });
    }

    flags.angularFilterNonInputControls = true;
    const filteredPath = join(testDir, 'argtypes-filtered.snapshot');
    const committedFiltered = existsSync(filteredPath)
      ? readFileSync(filteredPath, 'utf8')
      : undefined;
    const filteredArgTypes = extractArgTypes(asCompodocRef);
    await expect(filteredArgTypes).toMatchFileSnapshot(filteredPath);
    flags.angularFilterNonInputControls = false;
    if (committedFiltered !== undefined) {
      const parsed = parseArgTypesSnapshot(
        committedFiltered,
        `${fixtureCase}/argtypes-filtered.snapshot`
      );
      if (!snapshotsRewriteOnMismatch()) {
        expect(parsed).toEqual(filteredArgTypes);
      }
      expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate: filteredArgTypes! });
    }

    expect(Object.keys(stories).length).toBeGreaterThan(0);

    for (const [exportName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      // Production runs the actions addon's addActionsFromArgTypes args enhancer before
      // the source decorator: every output argType carries `action`, so outputs a story
      // does not set still receive an auto-injected handler arg and the legacy snippet
      // binds every declared output. Only key presence reaches the snippet text, so a
      // plain stub stands in for the injected action.
      const props: Record<string, unknown> = { ...meta.args, ...story.args };
      for (const [name, argType] of Object.entries(argTypes ?? {})) {
        if (argType.action && !(name in props)) {
          props[name] = () => {};
        }
      }
      const snippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const committedSnippet = existsSync(snippetPath)
        ? readFileSync(snippetPath, 'utf8')
        : undefined;
      const snippet = computesTemplateSourceFromComponent(component, props, argTypes!);
      await expect(snippet).toMatchFileSnapshot(snippetPath);
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'angular',
          args: props,
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
    }

    // toMatchFileSnapshot files sit outside vitest's obsolete-snapshot detection, so a
    // renamed or removed story export would silently leave its old snapshot on disk.
    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedSnippetFiles = Object.keys(stories)
      .map((exportName) => `snippet-${exportName}.snapshot`)
      .sort();
    expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
  });
});
