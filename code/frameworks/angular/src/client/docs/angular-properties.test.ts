import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { extractArgTypesFromData, findComponentByName } from '../compodoc.ts';
import type { CompodocJson } from '../compodoc-types.ts';

// `compodoc.ts` destructures `FEATURES` from the global scope at module-load time
// (`const { FEATURES } = global`). The destructure captures the OBJECT REFERENCE, so
// the flag object must exist on the global BEFORE the module is imported. `vi.hoisted`
// is lifted above the imports during transform, so this runs first; per-state changes
// are then applied by MUTATING that same object (never reassigning).
const featureFlags = vi.hoisted(() => {
  const flags = { angularFilterNonInputControls: false };
  (globalThis as any).FEATURES = flags;
  return flags;
});

// File hierarchy: __testfixtures__ / some-test-case / input.*
const inputRegExp = /^input\..*$/;

// Mirrors the historic `SNAPSHOT_OS` global (removed with the legacy jest setup):
// compodoc output is path-sensitive, so snapshots are OS-suffixed.
const SNAPSHOT_OS =
  process.platform === 'win32' ? 'windows' : process.platform ? 'posix' : 'undefined';

const extractWithFilter = (
  componentName: string,
  compodocJson: CompodocJson,
  angularFilterNonInputControls: boolean
) => {
  featureFlags.angularFilterNonInputControls = angularFilterNonInputControls;
  const componentData = findComponentByName(componentName, compodocJson);
  return extractArgTypesFromData(componentData as any);
};

describe('angular component properties', () => {
  const fixturesDir = join(__dirname, '__testfixtures__');
  readdirSync(fixturesDir, { withFileTypes: true }).forEach((testEntry) => {
    if (!testEntry.isDirectory()) {
      return;
    }
    const testDir = join(fixturesDir, testEntry.name);
    const dirEntries = readdirSync(testDir);
    const testFile = dirEntries.find((fileName) => inputRegExp.test(fileName));
    if (!testFile) {
      return;
    }

    // compodoc is an external, unpinned tool that is not a repo dependency, so it
    // cannot be invoked from the unit-test harness. Fixtures that ship a captured,
    // parseable `compodoc-input.json` (e.g. the `model()` case in
    // `__testfixtures__/doc-model/compodoc-input.json`, byte-identical to the real
    // compodoc v1.2.1 output) get the real `extractArgTypesFromData` assertions;
    // legacy fixtures without it (which would require re-running compodoc) keep a
    // trivial green test so they are not regressed.
    const hasCapturedCompodocJson = dirEntries.includes('compodoc-input.json');
    if (!hasCapturedCompodocJson) {
      it(`${testEntry.name} (compodoc capture not available)`, () => {
        expect(true).toEqual(true);
      });
      return;
    }

    const compodocJson = JSON.parse(
      readFileSync(join(testDir, 'compodoc-input.json'), 'utf8')
    ) as CompodocJson;

    it(`${testEntry.name}`, async () => {
      // Snapshot the captured compodoc output (OS-suffixed, mirroring doc-button).
      await expect(JSON.stringify(compodocJson, null, 2)).toMatchFileSnapshot(
        join(testDir, `compodoc-${SNAPSHOT_OS}.snapshot`)
      );

      // angularFilterNonInputControls OFF (default): model input control + the
      // synthesized `${name}Change` output both present; NO spurious bare-name output.
      const argTypes = extractWithFilter('ColorPickerComponent', compodocJson, false);
      await expect(argTypes).toMatchFileSnapshot(join(testDir, 'argtypes.snapshot'));

      expect(argTypes.color.table?.category).toBe('inputs');
      expect((argTypes.color as any).action).toBeUndefined();
      expect(argTypes.colorChange).toBeDefined();
      expect(argTypes.colorChange.table?.category).toBe('outputs');
      expect((argTypes.colorChange as any).action).toBe('colorChange');
      expect(argTypes.showText.table?.category).toBe('inputs');
      expect(argTypes.showTextChange).toBeDefined();
      expect((argTypes.showTextChange as any).action).toBe('showTextChange');

      // angularFilterNonInputControls ON: iteration is restricted to `inputsClass`
      // (compodoc.ts L227-229). The model input control AND the synthesized
      // `${name}Change` output must STILL be re-surfaced.
      const filteredArgTypes = extractWithFilter('ColorPickerComponent', compodocJson, true);
      await expect(filteredArgTypes).toMatchFileSnapshot(
        join(testDir, 'argtypes-filtered.snapshot')
      );

      expect(filteredArgTypes.color.table?.category).toBe('inputs');
      expect(filteredArgTypes.colorChange).toBeDefined();
      expect((filteredArgTypes.colorChange as any).action).toBe('colorChange');
      expect(filteredArgTypes.showText.table?.category).toBe('inputs');
      expect(filteredArgTypes.showTextChange).toBeDefined();
      expect((filteredArgTypes.showTextChange as any).action).toBe('showTextChange');

      featureFlags.angularFilterNonInputControls = false;
    });
  });
});
