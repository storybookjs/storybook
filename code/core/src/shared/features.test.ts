import { afterEach, expect, it, vi } from 'vitest';

import { instanceContext } from '../instance/instance-context.ts';
import { getFeatures } from './features.ts';
import type { InstanceContext } from './instance-context.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([
  {
    name: 'inside an instance with features',
    input: { context: { features: { docgenServer: true } }, global: { docgenServer: false } },
    expected: { docgenServer: true },
  },
  {
    name: 'inside an instance without features',
    input: { context: { features: undefined }, global: { docgenServer: true } },
    expected: {},
  },
  {
    name: 'outside an instance with an injected global',
    input: { context: undefined, global: { docgenServer: true } },
    expected: { docgenServer: true },
  },
  {
    name: 'outside an instance without an injected global',
    input: { context: undefined, global: undefined },
    expected: {},
  },
])('reads features $name', ({ input, expected }) => {
  vi.stubGlobal('FEATURES', input.global);
  const features = input.context
    ? instanceContext.run(input.context as InstanceContext, getFeatures)
    : getFeatures();
  expect(features).toEqual(expected);
});
