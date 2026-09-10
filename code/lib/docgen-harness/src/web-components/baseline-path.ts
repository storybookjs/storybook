// Which pipeline produced the committed baselines in __testfixtures__.
// Flipping this to 'osa' hardens every test.fails red marker in web-components-legacy-gaps.test.ts
// into a plain requirement.
export type BaselinePath = 'legacy' | 'osa';

export const BASELINE_PATH: BaselinePath = 'legacy';
