// @vitest-environment happy-dom
// happy-dom provides the DOMParser that compodoc.ts instantiates for @default JSDoc tags.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';
import { attachAotCmp, recordSnippets } from './render-helpers.ts';
import { fixtureCases, fixturesDir } from './snippet-recorder.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'angular-baselines.test.ts records the legacy Compodoc client path; update the recorder or baseline-path.ts'
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('angular legacy baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    expect(existsSync(join(testDir, `${fixtureCase}.component.ts`))).toBe(true);

    setCompodocJson(JSON.parse(readFileSync(join(testDir, 'compodoc-input.json'), 'utf8')));

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;
    const component = meta.component;

    await attachAotCmp(component, fixtureCase);

    // extractArgTypes declares the compodoc-JSON-shaped Component | Directive parameter;
    // production passes the real class through an untyped parameters slot, so the
    // recorder needs a call-site cast. The uncast class stays correct for the snippet
    // call (Type<unknown> accepts it structurally).
    const asCompodocRef = component as unknown as Parameters<typeof extractArgTypes>[0];

    const recordArgTypes = async (filterNonInputControls: boolean, fileName: string) => {
      flags.angularFilterNonInputControls = filterNonInputControls;
      const extracted = extractArgTypes(asCompodocRef);
      flags.angularFilterNonInputControls = false;
      // The baseline is this pipeline's own compodoc recording, so its invented defaults are waived.
      await recordArgTypesSnapshot({
        path: join(testDir, fileName),
        label: `${fixtureCase}/${fileName}`,
        candidate: extracted!,
        legacyBaseline: true,
      });
      return extracted;
    };

    const argTypes = await recordArgTypes(false, 'argtypes.snapshot');
    await recordArgTypes(true, 'argtypes-filtered.snapshot');

    await recordSnippets({ fixtureCase, component, meta, stories, argTypes, recorder: 'legacy' });
  });
});
