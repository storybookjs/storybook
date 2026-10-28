import { expect, it } from 'vitest';

import { getDocgenProvider } from './docgen-provider.ts';

it.each<{
  name: string;
  frameworkOptions: Parameters<typeof getDocgenProvider>[0];
  features: Parameters<typeof getDocgenProvider>[1];
  expected: unknown;
}>([
  {
    name: 'defaults to the api props table',
    frameworkOptions: {},
    features: {},
    expected: { propsTable: 'api' },
  },
  {
    name: 'maps the deprecated feature onto the inputs props table',
    frameworkOptions: {},
    features: { angularFilterNonInputControls: true },
    expected: { propsTable: 'inputs' },
  },
  {
    name: 'prefers the framework option over the deprecated feature',
    frameworkOptions: { propsTable: 'all' },
    features: { angularFilterNonInputControls: true },
    expected: { propsTable: 'all' },
  },
])('$name', ({ frameworkOptions, features, expected }) => {
  const provider = getDocgenProvider(frameworkOptions, features);

  expect(provider.moduleSpecifier).toContain('docgen-worker');
  expect(provider.options).toEqual(expected);
});
