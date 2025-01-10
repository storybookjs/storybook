import type { AxeResults } from 'axe-core';

export type A11YReport = AxeResults | { error: Error };
