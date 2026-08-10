// Records `acm-` prefixed snapshots for the in-process Angular analyzer next to the legacy compodoc
// ones, gating every extraction against both. Unlike angular-baselines.test.ts it needs no happy-dom
// environment: nothing in its import graph instantiates DOMParser.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { AngularComponentMetaManager, extractArgTypesFromData } from '@storybook/angular-cm';
import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { isSnapshotUpdateRun } from '../compare/is-snapshot-update-run.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { pendingRawSnapshotContent } from '../compare/pending-raw-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';
import {
  attachAotCmp,
  fixtureCases,
  fixturesDir,
  readCommitted,
  recordSnippets,
} from './render-helpers.ts';

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

      const recordArgTypes = async (filterNonInputControls: boolean, prefix: string) => {
        const acmPath = join(testDir, `acm-${prefix}.snapshot`);
        const acmLabel = `${fixtureCase}/acm-${prefix}.snapshot`;
        const committedAcm = readCommitted(acmPath);
        // The same call the docgen worker makes, so the recorded baselines represent production
        // output.
        const extracted = extractArgTypesFromData(entry, {
          metadataJson: json,
          filterNonInputControls,
        }) as StrictArgTypes;

        // Both gates run BEFORE the snapshot call: under `-u` that call queues the rewrite, so a gate
        // placed after it would persist the regressed recording and the rerun would go green.
        const parsedAcm =
          committedAcm !== undefined ? parseArgTypesSnapshot(committedAcm, acmLabel) : undefined;
        if (parsedAcm !== undefined) {
          // The one leg whose baseline the same engine recorded, so its table values are trustworthy
          // enough to gate summary text and required flips too.
          expectCurrentOrBetter({
            kind: 'argTypes',
            baseline: parsedAcm,
            candidate: extracted,
            strictTable: true,
          });
        }

        // Asserted to exist so deleting the legacy files can never silently disarm the parity gate.
        const committedLegacy = readCommitted(join(testDir, `${prefix}.snapshot`));
        expect(committedLegacy, `missing legacy ${fixtureCase}/${prefix}.snapshot`).toBeDefined();
        expectCurrentOrBetter({
          kind: 'argTypes',
          baseline: parseArgTypesSnapshot(committedLegacy!, `${fixtureCase}/${prefix}.snapshot`),
          candidate: extracted,
          legacyBaseline: true,
        });

        await expect(extracted).toMatchFileSnapshot(acmPath);

        if (isSnapshotUpdateRun()) {
          // `-u` skips the round-trip proof below, so the bytes this run will flush are checked here
          // instead; a recording whose unescaped write misparses can then never land green.
          const finalText = pendingRawSnapshotContent(acmPath) ?? committedAcm;
          expect(finalText, `no snapshot content recorded for ${acmLabel}`).toBeDefined();
          expect(parseArgTypesSnapshot(finalText!, acmLabel)).toEqual(extracted);
        } else if (parsedAcm !== undefined) {
          // The tokenizer must reconstruct exactly what pretty-format wrote.
          expect(parsedAcm).toEqual(extracted);
        }

        return extracted;
      };

      const argTypes = await recordArgTypes(false, 'argtypes');
      await recordArgTypes(true, 'argtypes-filtered');

      const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
      const { default: meta, ...stories } = storiesModule;
      const component = meta.component;

      await attachAotCmp(component, fixtureCase);

      await recordSnippets({
        fixtureCase,
        component,
        meta,
        stories,
        argTypes,
        prefix: 'acm-snippet-',
        legacyParity: true,
      });
    },
    // Each fixture's first extraction builds a cold TS LanguageService program (lib +
    // @angular/core types), which can outrun the 10s default on CI.
    30_000
  );
});
