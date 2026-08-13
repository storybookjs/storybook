// Records `acm-` prefixed snapshots for the in-process Angular analyzer next to the legacy compodoc
// ones, gating every extraction against both. Unlike angular-baselines.test.ts it needs no happy-dom
// environment: nothing in its import graph instantiates DOMParser.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import type { PropsTableMode } from '@storybook/angular-cm';
import { AngularComponentMetaManager, extractArgTypesFromData } from '@storybook/angular-cm';
import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';
import { attachAotCmp, recordSnippets } from './render-helpers.ts';
import { fixtureCases, fixturesDir, readCommitted } from './snippet-recorder.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'angular-component-meta-baselines.test.ts gates the ACM engine against the legacy Compodoc baselines; revisit this recorder together with baseline-path.ts'
  );
}

// One manager for the whole suite: each fixture directory carries its own tsconfig.json
// (include: ["./*.ts"]), so every component file resolves to its own per-fixture project.
const manager = new AngularComponentMetaManager(ts);

afterAll(() => {
  manager.dispose();
});

describe('angular component-meta baselines', () => {
  it.each(fixtureCases)(
    '%s',
    async (fixtureCase) => {
      const testDir = join(fixturesDir, fixtureCase);
      const componentPath = join(testDir, `${fixtureCase}.component.ts`);
      expect(existsSync(componentPath)).toBe(true);

      // Signal fixtures cannot mount under JIT, so `meta.component.name` is not available for every
      // fixture; each component file exports exactly one class under its own name instead.
      const componentSource = readFileSync(componentPath, 'utf8');
      const exportedClassNames = [
        ...componentSource.matchAll(/^export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm),
      ].map((match) => match[1]);
      expect(exportedClassNames).toHaveLength(1);
      const componentExportName = exportedClassNames[0];

      const result = manager.extractComponentMeta(componentPath, {
        exportName: componentExportName,
      });
      expect(result, `extractComponentMeta found no '${componentExportName}'`).toBeDefined();
      const { entry, json } = result!;

      // The same calls the docgen worker makes, so the recorded baselines represent production
      // output: `api` is the default and `inputs` is what the deprecated flag maps onto.
      const extract = (propsTable: PropsTableMode) =>
        extractArgTypesFromData(entry, { metadataJson: json, propsTable }) as StrictArgTypes;

      // Members `api` suppresses by design. Both legs waive the same set: a member the visibility
      // filter removed is equally absent from `inputs`, and a genuinely lost input is in neither.
      const everyMember = extract('all');
      const apiArgTypes = extract('api');
      const intentionallyDropped = new Set(
        Object.keys(everyMember).filter((name) => !(name in apiArgTypes))
      );

      const recordArgTypes = async (extracted: StrictArgTypes, prefix: string) => {
        const legacyLabel = `${fixtureCase}/${prefix}.snapshot`;
        // Asserted to exist so deleting the legacy files can never silently disarm the parity gate.
        const committedLegacy = readCommitted(join(testDir, `${prefix}.snapshot`));
        expect(committedLegacy, `missing legacy ${legacyLabel}`).toBeDefined();

        await recordArgTypesSnapshot({
          path: join(testDir, `acm-${prefix}.snapshot`),
          label: `${fixtureCase}/acm-${prefix}.snapshot`,
          candidate: extracted,
          // The self-ratchet leg's baseline was written by this same engine, so its table values are
          // trustworthy enough to gate summary text and required flips too.
          strictTable: true,
          intentionallyDropped,
          extraGates: [
            {
              committed: committedLegacy!,
              label: legacyLabel,
              legacyBaseline: true,
              intentionallyDropped,
            },
          ],
        });

        return extracted;
      };

      const argTypes = await recordArgTypes(apiArgTypes, 'argtypes');
      await recordArgTypes(extract('inputs'), 'argtypes-filtered');

      const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
      const { default: meta, ...stories } = storiesModule;
      const component = meta.component;

      await attachAotCmp(component, fixtureCase);

      await recordSnippets({ fixtureCase, component, meta, stories, argTypes, recorder: 'acm' });
    },
    // Each fixture's first extraction builds a cold TS LanguageService program (lib +
    // @angular/core types), which can outrun the 10s default on CI.
    30_000
  );

  it('drops what no template can bind and keeps what one can', () => {
    const testDir = join(fixturesDir, 'properties-methods-noise');
    const result = manager.extractComponentMeta(
      join(testDir, 'properties-methods-noise.component.ts'),
      { exportName: 'PropertiesMethodsNoiseComponent' }
    );
    const argNames = (propsTable: PropsTableMode) =>
      Object.keys(
        extractArgTypesFromData(result!.entry, { metadataJson: result!.json, propsTable })
      );

    expect(argNames('all')).toEqual(expect.arrayContaining(['cdr', 'pageCount', 'markDirty']));

    // `protected` is bindable from a template in every supported Angular version, so removing it
    // would delete real API. This is the guard on that.
    expect(argNames('api')).toEqual(expect.arrayContaining(['helperLabel', 'clampPage']));

    expect(argNames('api')).not.toContain('cdr');
    expect(argNames('api')).not.toContain('pageCount');
    expect(argNames('api')).not.toContain('markDirty');
    expect(argNames('api')).not.toContain('buildId');
    expect(argNames('api')).not.toContain('resetPage');
    expect(argNames('api')).toEqual(expect.arrayContaining(['title', 'currentPage', 'nextPage']));
  }, 30_000);
});
