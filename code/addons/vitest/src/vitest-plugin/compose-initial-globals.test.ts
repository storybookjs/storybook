import { describe, expect, it } from 'vitest';

import { STORYBOOK_TEST_PROVIDE_KEY } from '../constants.ts';
import { composeInitialGlobals } from './compose-initial-globals.ts';

describe('composeInitialGlobals', () => {
  const base = {
    runConfig: { a11y: true },
    ghostStoriesEnabled: false,
    renderAnalysisEnabled: false,
    shouldRunA11yTests: true,
  };

  it('applies the project initialGlobals', () => {
    const globals = composeInitialGlobals({ ...base, userInitialGlobals: { theme: 'dark' } });
    expect(globals.theme).toBe('dark');
  });

  it("keeps Storybook's run-control globals overriding user values", () => {
    const globals = composeInitialGlobals({
      ...base,
      shouldRunA11yTests: false,
      userInitialGlobals: {
        a11y: { manual: false, config: { rules: [] } },
        ghostStories: { enabled: true },
        [STORYBOOK_TEST_PROVIDE_KEY]: { hijacked: true },
      },
    });
    // `manual` is derived from the run, but other a11y fields the project set are kept
    expect(globals.a11y).toEqual({ manual: true, config: { rules: [] } });
    // the test-provided run config can't be clobbered by a user global
    expect(globals[STORYBOOK_TEST_PROVIDE_KEY]).toEqual({ a11y: true });
    // a project can't inject the internal ghost-stories flag when the feature is off
    expect(globals.ghostStories).toBeUndefined();
  });

  it('adds ghost-stories and render-analysis flags when enabled', () => {
    const globals = composeInitialGlobals({
      ...base,
      userInitialGlobals: {},
      ghostStoriesEnabled: true,
      renderAnalysisEnabled: true,
    });
    expect(globals.ghostStories).toEqual({ enabled: true });
    expect(globals.renderAnalysis).toEqual({ enabled: true });
  });
});
