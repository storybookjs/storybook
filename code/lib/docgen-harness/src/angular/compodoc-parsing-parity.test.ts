import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { CompodocJson } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, getComponentData, htmlToText } from '@storybook/angular-compodoc';
import { isSnapshotUpdateRun } from '../compare/is-snapshot-update-run.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { BASELINE_PATH } from './baseline-path.ts';

if (BASELINE_PATH !== 'legacy') {
  throw new Error(
    'compodoc-parsing-parity.test.ts compares a Node host against the legacy baselines; update it or baseline-path.ts'
  );
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** The shared module is environment-agnostic, so a Node host injects what the browser reads off globals. */
const nodeExtract = (name: string, compodocJson: CompodocJson, filterNonInputControls: boolean) => {
  const logger = { warn: () => {}, debug: () => {} };
  const componentData = getComponentData({ name } as never, { compodocJson, logger });
  return (
    componentData &&
    extractArgTypesFromData(componentData, {
      compodocJson,
      filterNonInputControls,
      logger,
      unwrapHtml: htmlToText,
    })
  );
};

/**
 * The oracle is the committed legacy baseline, recorded through the browser path with a real
 * `DOMParser`. Asserting a Node host against those files - rather than against another call into
 * the same shared functions - is what lets this test fail when the shared parsing module or its
 * Node-side `DOMParser` replacement changes behaviour.
 */
describe('a Node host reproduces the committed legacy baselines', () => {
  it.each(fixtureCases)('%s', (fixtureCase) => {
    const compodocJson = JSON.parse(
      readFileSync(join(fixturesDir, fixtureCase, 'compodoc-input.json'), 'utf8')
    ) as CompodocJson;

    // The component the baseline recorder extracted through `meta.component`; every fixture
    // documents exactly one component or directive (abstract bases live in `classes`).
    const documented = [...(compodocJson.components ?? []), ...(compodocJson.directives ?? [])];
    expect(documented).toHaveLength(1);

    for (const [fileName, filterNonInputControls] of [
      ['argtypes.snapshot', false],
      ['argtypes-filtered.snapshot', true],
    ] as const) {
      const committed = readFileSync(join(fixturesDir, fixtureCase, fileName), 'utf8');
      const extracted = nodeExtract(documented[0].name, compodocJson, filterNonInputControls);

      if (!isSnapshotUpdateRun()) {
        expect(extracted, `${fixtureCase}/${fileName}`).toEqual(
          parseArgTypesSnapshot(committed, `${fixtureCase}/${fileName}`)
        );
      }
    }
  });
});
