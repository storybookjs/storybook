import type { StorybookConfigRaw, TestBuildConfig } from '@storybook/core/internal/types';

/** Inputs that shape the resolved `docs` config. */
export interface DocsConfigInput {
  /** Test builds can disable autodocs entirely. */
  build?: TestBuildConfig;
  /** Name for generated docs entries. */
  defaultName?: string;
  /** The `--docs` CLI flag. */
  docsMode?: boolean;
}

/** Resolve the `docs` config, or nothing when a test build disables autodocs. */
export function resolveDocsConfig(
  input: StorybookConfigRaw['docs'] = {},
  { build, defaultName, docsMode }: DocsConfigInput
): StorybookConfigRaw['docs'] {
  if (build?.test?.disableAutoDocs) {
    return undefined;
  }

  const result: StorybookConfigRaw['docs'] = {
    ...input,
    defaultName: defaultName ?? 'Docs',
  };

  if (docsMode) {
    result.docsMode = docsMode;
  }
  return result;
}
