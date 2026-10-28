import type {
  BuilderOptions,
  CLIOptions,
  LoadOptions,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

/** Options every legacy preset function receives. */
export type InterPresetOptions = Omit<
  CLIOptions &
    LoadOptions &
    BuilderOptions & { isCritical?: boolean; build?: StorybookConfigRaw['build'] },
  'frameworkPresets'
>;
