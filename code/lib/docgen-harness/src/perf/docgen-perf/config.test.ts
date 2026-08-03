import { describe, expect, it } from 'vitest';

import { MIN_SAVES_FOR_SLOPE } from '../docgen-shared/stats.ts';
import { DEFAULT_PROFILE, PINNED_N, QUICK_PROFILE, type SuiteProfile } from './config.ts';

const savesPerScenario = (profile: SuiteProfile): Array<{ name: string; saves: number }> => [
  ...profile.react.map((scenario) => ({ name: `react/${scenario.shape}`, saves: scenario.saves })),
  ...profile.vue.map((scenario) => ({ name: `vue/${scenario.name}`, saves: scenario.saves })),
];

describe.each([
  ['default', DEFAULT_PROFILE],
  ['quick', QUICK_PROFILE],
])('%s profile', (_name, profile) => {
  // The slope fit drops the settle save, so a scenario configured below this floor reports no
  // retained metrics and the aggregation fails the whole engine - a smoke run that cannot smoke.
  it('runs enough saves for every scenario to produce a retained slope', () => {
    for (const { name, saves } of savesPerScenario(profile)) {
      expect(saves, name).toBeGreaterThanOrEqual(MIN_SAVES_FOR_SLOPE);
    }
  });
});

describe('the pinned profile', () => {
  it('measures at the pinned N and says its numbers are comparable', () => {
    expect(DEFAULT_PROFILE.n).toBe(PINNED_N);
    expect(DEFAULT_PROFILE.comparable).toBe(true);
  });

  it('marks the quick profile non-comparable, so its numbers can never become a baseline', () => {
    expect(QUICK_PROFILE.comparable).toBe(false);
  });
});
