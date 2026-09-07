import { STORYBOOK_TEST_PROVIDE_KEY } from '../constants.ts';

/**
 * Build the globals each story runs under: the project's `initialGlobals` (set via
 * `storybookTest({ initialGlobals })`) merged BENEATH Storybook's own run-control globals, so those
 * always win and a consumer can't clobber them (`a11y.manual`, the test-provided run config, and the
 * ghost-stories / render-analysis flags).
 */
export const composeInitialGlobals = ({
  userInitialGlobals,
  runConfig,
  ghostStoriesEnabled,
  renderAnalysisEnabled,
  shouldRunA11yTests,
}: {
  userInitialGlobals: Record<string, unknown>;
  runConfig: Record<string, unknown>;
  ghostStoriesEnabled: boolean;
  renderAnalysisEnabled: boolean;
  shouldRunA11yTests: boolean;
}): Record<string, unknown> => {
  // Start from the project's globals, then force Storybook's run-control globals on top so a
  // project's `initialGlobals` can never override them (whatever value it set for these keys).
  const globals: Record<string, unknown> = { ...userInitialGlobals };

  globals[STORYBOOK_TEST_PROVIDE_KEY] = runConfig;

  // Match the original behaviour: the key is present only when the feature is enabled, so a
  // project-supplied value is dropped when it isn't.
  if (ghostStoriesEnabled) {
    globals.ghostStories = { enabled: true };
  } else {
    delete globals.ghostStories;
  }
  if (renderAnalysisEnabled) {
    globals.renderAnalysis = { enabled: true };
  } else {
    delete globals.renderAnalysis;
  }

  // Keep any other a11y globals the project set; only `manual` is owned by the run.
  globals.a11y = {
    ...(globals.a11y as Record<string, unknown> | undefined),
    manual: !shouldRunA11yTests,
  };

  return globals;
};
