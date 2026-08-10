// Recorder for the Angular Component Meta (ACM) engine: extracts each fixture component
// through AngularComponentMetaManager, feeds the result through the shared compodoc-shaped
// argTypes extraction, and records `acm-` prefixed snapshots next to the legacy ones.
// Every extraction is additionally parity-gated "current or better" against the committed
// LEGACY baselines (argtypes*.snapshot / snippet-*.snapshot), so the new engine can never
// silently lose what the compodoc pipeline records today.
//
// Unlike angular-baselines.test.ts this file needs no happy-dom environment and no FEATURES
// stub: the filter flag and the HTML unwrapper arrive as explicit arguments, and nothing in
// its import graph instantiates DOMParser.
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

      // Every fixture's component file exports exactly one class under its own name (the
      // legacy capture requires the class name to match compodoc's), so a source scan is
      // the robust way to learn the export name: signal fixtures cannot mount under JIT,
      // which rules out reading `meta.component.name` uniformly.
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

        // Both gates run BEFORE the snapshot call: under `-u` that call queues the rewrite, so a
        // gate placed after it would turn the run red while still persisting the regressed
        // recording - and the rerun would then compare regressed-vs-regressed and go green.
        const parsedAcm =
          committedAcm !== undefined ? parseArgTypesSnapshot(committedAcm, acmLabel) : undefined;
        if (parsedAcm !== undefined) {
          // Self-ratchet: never regress against the ACM's own previous recording, which may
          // already be better than legacy (e.g. a type legacy stubs as empty-enum). This is the
          // one leg whose baseline table values the same engine recorded, so it also gates
          // summary text and required flips.
          expectCurrentOrBetter({
            kind: 'argTypes',
            baseline: parsedAcm,
            candidate: extracted,
            strictTable: true,
          });
        }

        // Parity gate: the ACM extraction must hold everything the legacy pipeline records.
        // Asserted to exist so deleting the legacy files can never silently disarm this gate.
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
          // `-u` skips the committed-text proof below, so prove the bytes this run will flush at
          // suite end (or the committed bytes, when nothing changed) parse back to the live
          // extraction - a recording whose unescaped write misparses can then never land green.
          const finalText = pendingRawSnapshotContent(acmPath) ?? committedAcm;
          expect(finalText, `no snapshot content recorded for ${acmLabel}`).toBeDefined();
          expect(parseArgTypesSnapshot(finalText!, acmLabel)).toEqual(extracted);
        } else if (parsedAcm !== undefined) {
          // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
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
