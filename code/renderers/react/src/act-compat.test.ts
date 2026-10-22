import { expect, it, vi } from 'vitest';

import { getAct, getReactActEnvironment } from './act-compat.ts';

// React 19's production build: no `act`.
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  const production = { ...react, act: undefined, version: '19.2.0' };
  return { ...production, default: production };
});

it('renders without act where React has none, as React 19 production', async () => {
  const act = await getAct();
  const callback = vi.fn(() => 'rendered');

  expect(act(callback)).toBe('rendered');
  expect(callback).toHaveBeenCalledOnce();
  // Not an act environment: React would warn of an update outside `act()`.
  expect(getReactActEnvironment()).toBeUndefined();
});
