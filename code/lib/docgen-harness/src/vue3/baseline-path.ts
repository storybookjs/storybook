// Which pipeline produced the committed baselines in __testfixtures__.
// Flipping this to 'osa' (together with re-pointing the recorder in vue3-baselines.test.ts)
// hardens every test.fails red marker in vue3-legacy-gaps.test.ts into a plain requirement.
export type BaselinePath = 'legacy' | 'osa';

export const BASELINE_PATH: BaselinePath = 'legacy';
