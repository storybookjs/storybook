// The docgen-server render path for the props table: the worker payload is filtered by
// `propsTable`, but the UI unions the client-side `customArgTypes` back on top of it
// (`mergeServiceArgTypes`), and `customArgTypes` is fed by `parameters.docs.extractArgTypes`.
// Every other test stops at `extractArgTypesFromData`; this one gates the seam where an unfiltered
// Compodoc extraction would resurrect the filtered members in the rendered table.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

// config.ts reads FEATURES through @storybook/global at call time, but the compodoc adapter in its
// import graph destructures FEATURES at first import, so the stub must exist before that.
const flags = vi.hoisted(() => {
  const features = { angularFilterNonInputControls: false, experimentalDocgenServer: false };
  vi.stubGlobal('FEATURES', features);
  return features;
});

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { mergeServiceArgTypes } from '../../../../core/src/docs-tools/argTypes/docgenServiceArgTypes.ts';
import { setCompodocJson } from '../../../../frameworks/angular-vite/src/client/compodoc.ts';
import { parameters } from '../../../../frameworks/angular-vite/src/client/config.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';
import { DecoratorGetterSetterComponent } from './__testfixtures__/decorator-getter-setter/decorator-getter-setter.component.ts';
import { fixturesDir } from './snippet-recorder.ts';

const testDir = join(fixturesDir, 'decorator-getter-setter');

setCompodocJson(JSON.parse(readFileSync(join(testDir, 'compodoc-input.json'), 'utf8')));

// The committed `api`-mode recording of the same fixture: `volume` without its private backing
// field, exactly what the worker ships as `payload.argTypes`.
const payloadArgTypes = parseArgTypesSnapshot(
  readFileSync(join(testDir, 'acm-argtypes.snapshot'), 'utf8'),
  'decorator-getter-setter/acm-argtypes.snapshot'
);

const extractArgTypes = parameters.docs.extractArgTypes as (
  component: unknown
) => StrictArgTypes | null;

const mergedWith = (customArgTypes: StrictArgTypes) =>
  mergeServiceArgTypes({
    payload: { argTypes: payloadArgTypes } as never,
    storyId: 'example-decorator--basic',
    parameters: {},
    initialArgs: {},
    customArgTypes,
  });

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('parameters.docs.extractArgTypes under the docgen server', () => {
  it('extracts through Compodoc when the feature is off', () => {
    flags.experimentalDocgenServer = false;

    expect(Object.keys(extractArgTypes(DecoratorGetterSetterComponent)!)).toEqual(
      expect.arrayContaining(['innerVolume', 'volume'])
    );
  });

  it('contributes nothing when the worker payload owns extraction, but stays defined', () => {
    flags.experimentalDocgenServer = true;

    expect(extractArgTypes(DecoratorGetterSetterComponent)).toEqual({});
  });

  it('keeps a filtered member out of the merged table, which an unfiltered extraction would resurrect', () => {
    expect(payloadArgTypes).not.toHaveProperty('innerVolume');

    flags.experimentalDocgenServer = false;
    const resurrected = mergedWith(extractArgTypes(DecoratorGetterSetterComponent)!);
    expect(Object.keys(resurrected)).toContain('innerVolume');

    flags.experimentalDocgenServer = true;
    const merged = mergedWith(extractArgTypes(DecoratorGetterSetterComponent)!);
    expect(Object.keys(merged)).toContain('volume');
    expect(Object.keys(merged)).not.toContain('innerVolume');
  });
});
