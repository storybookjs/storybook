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
import { isSnapshotUpdateRun } from '../compare/is-snapshot-update-run.ts';
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

const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

type AotCmp = {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
};

describe('angular legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    expect(existsSync(join(testDir, `${fixtureCase}.component.ts`))).toBe(true);

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

    const recordArgTypes = async (filterNonInputControls: boolean, fileName: string) => {
      flags.angularFilterNonInputControls = filterNonInputControls;
      const path = join(testDir, fileName);
      const committed = readCommitted(path);
      const extracted = extractArgTypes(asCompodocRef);
      await expect(extracted).toMatchFileSnapshot(path);
      flags.angularFilterNonInputControls = false;
      if (committed !== undefined) {
        const parsed = parseArgTypesSnapshot(committed, `${fixtureCase}/${fileName}`);
        if (!isSnapshotUpdateRun()) {
          // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
          expect(parsed).toEqual(extracted);
        }
        expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate: extracted! });
      }
      return extracted;
    };

    const argTypes = await recordArgTypes(false, 'argtypes.snapshot');
    await recordArgTypes(true, 'argtypes-filtered.snapshot');

    expect(Object.keys(stories).length).toBeGreaterThan(0);

    const actionArgNames = Object.entries(argTypes ?? {})
      .filter(([, argType]) => argType.action)
      .map(([name]) => name);

    for (const [exportName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      const props: Record<string, unknown> = { ...meta.args, ...story.args };
      for (const name of actionArgNames) {
        if (!(name in props)) {
          props[name] = () => {};
        }
      }
      const snippetPath = join(testDir, `snippet-${exportName}.snapshot`);
      const committedSnippet = readCommitted(snippetPath);
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
