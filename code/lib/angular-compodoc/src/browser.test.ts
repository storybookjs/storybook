import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractArgTypesFromData, setCompodocJson } from './browser.ts';

const flags = { angularFilterNonInputControls: false };

setCompodocJson({
  components: [],
  directives: [],
  pipes: [],
  injectables: [],
  classes: [],
  miscellaneous: { typealiases: [], enumerations: [] },
} as never);

beforeEach(() => {
  flags.angularFilterNonInputControls = false;
  vi.stubGlobal('FEATURES', flags);
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
