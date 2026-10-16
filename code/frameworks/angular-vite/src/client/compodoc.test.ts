// How this framework's `propsTable` mode reaches the legacy Compodoc adapter. The module reads
// `STORYBOOK_ANGULAR_OPTIONS` at evaluation time, so every case re-imports it fresh.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompodocJson, Directive } from './compodoc-types.ts';

const compodocJson: Partial<CompodocJson> = {
  components: [],
  directives: [],
  pipes: [],
  injectables: [],
  classes: [],
  miscellaneous: { typealiases: [], enumerations: [] } as never,
};

const componentData: Partial<Directive> = {
  name: 'ProbeComponent',
  type: 'component',
  inputsClass: [{ name: 'label', type: 'string', optional: false }],
  outputsClass: [],
  propertiesClass: [{ name: 'note', type: 'string', optional: false }],
  methodsClass: [],
};

const extractedNames = async () => {
  const { extractArgTypesFromData } = await import('./compodoc.ts');
  return Object.keys(extractArgTypesFromData(componentData as never));
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('FEATURES', { angularFilterNonInputControls: false });
  vi.stubGlobal('__STORYBOOK_COMPODOC_JSON__', compodocJson);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolving propsTable for the Compodoc pipeline', () => {
  it("maps 'inputs' onto the legacy inputs-only filter", async () => {
    vi.stubGlobal('STORYBOOK_ANGULAR_OPTIONS', { zoneless: true, propsTable: 'inputs' });

    await expect(extractedNames()).resolves.toEqual(['label']);
  });

  it("reads 'api' as all, because Compodoc's visibility is not interpretable here", async () => {
    vi.stubGlobal('STORYBOOK_ANGULAR_OPTIONS', { zoneless: true, propsTable: 'api' });

    await expect(extractedNames()).resolves.toEqual(['note', 'label']);
  });

  it("overrides the deprecated feature whenever a mode is defined, 'all' included", async () => {
    vi.stubGlobal('FEATURES', { angularFilterNonInputControls: true });
    vi.stubGlobal('STORYBOOK_ANGULAR_OPTIONS', { zoneless: true, propsTable: 'all' });

    await expect(extractedNames()).resolves.toEqual(['note', 'label']);
  });

  it('falls back to the deprecated feature when the define never ran', async () => {
    vi.stubGlobal('FEATURES', { angularFilterNonInputControls: true });

    await expect(extractedNames()).resolves.toEqual(['label']);
  });
});
