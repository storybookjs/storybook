import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

// browser.ts destructures FEATURES from the global once at first import, so the stub must exist
// before that import evaluates; only property mutation on this reference is live afterwards.
const flags = vi.hoisted(() => {
  const features = { angularFilterNonInputControls: false };
  vi.stubGlobal('FEATURES', features);
  return features;
});

import { extractArgTypesFromData, setCompodocJson } from './browser.ts';

setCompodocJson({
  components: [],
  directives: [],
  pipes: [],
  injectables: [],
  classes: [],
  miscellaneous: { typealiases: [], enumerations: [] },
} as never);

afterEach(() => {
  flags.angularFilterNonInputControls = false;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const componentData = {
  name: 'ProbeComponent',
  type: 'component',
  inputsClass: [{ name: 'label', type: 'string', optional: false }],
  outputsClass: [],
  propertiesClass: [{ name: 'note', type: 'string', optional: false }],
  methodsClass: [],
} as never;

const names = (options?: Parameters<typeof extractArgTypesFromData>[1]) =>
  Object.keys(extractArgTypesFromData(componentData, options));

describe('the per-call option versus the deprecated feature', () => {
  it('falls back to the feature when no option is passed', () => {
    expect(names()).toEqual(['note', 'label']);

    flags.angularFilterNonInputControls = true;
    expect(names()).toEqual(['label']);
  });

  it('lets the option decide when it is passed, whatever the feature says', () => {
    flags.angularFilterNonInputControls = true;
    expect(names({ filterNonInputControls: false })).toEqual(['note', 'label']);

    flags.angularFilterNonInputControls = false;
    expect(names({ filterNonInputControls: true })).toEqual(['label']);
  });
});
