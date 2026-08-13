import { describe, expect, it } from 'vitest';

import { MIN_SAVES_FOR_SLOPE } from '../docgen-shared/stats.ts';
import { DEFAULT_PROFILE, QUICK_PROFILE, type SuiteProfile } from './config.ts';

const savesPerScenario = (profile: SuiteProfile): Array<{ name: string; saves: number }> => [
  ...profile.react.map((scenario) => ({ name: `react/${scenario.shape}`, saves: scenario.saves })),
  ...profile.vue.map((scenario) => ({ name: `vue/${scenario.name}`, saves: scenario.saves })),
];

describe.each([
  ['default', DEFAULT_PROFILE],
  ['quick', QUICK_PROFILE],
])('%s profile', (_name, profile) => {
  // Below the floor the run reports no retained metrics and fails the engine outright.
  it('runs enough saves for every scenario to produce a retained slope', () => {
    for (const { name, saves } of savesPerScenario(profile)) {
      expect(saves, name).toBeGreaterThanOrEqual(MIN_SAVES_FOR_SLOPE);
    }
  });
});

// The gate asserts `comparable` before anything else, so this flag is the only thing standing
// between a smoke run's numbers and a recorded baseline.
it('marks the quick profile non-comparable, so its numbers can never become a baseline', () => {
  expect(QUICK_PROFILE.comparable).toBe(false);
});
