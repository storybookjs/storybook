import type { Channel } from '@storybook/core/internal/channels';
import { createStorybook, getInstanceContext } from 'storybook/internal/instance';
import type {
  BuilderOptions,
  CLIOptions,
  LoadOptions,
  Options,
} from '@storybook/core/internal/types';

/**
 * Load the Storybook in `configDir` as preset options.
 *
 * @deprecated Use `createStorybook({ configDir, mode: 'headless' })` from
 *   `storybook/internal/instance`, and close it when done.
 */
export async function experimental_loadStorybook(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      storybookVersion?: string;
      previewConfigPath?: string;
      /** Ignored: the instance owns its channel. */
      channel?: Channel;
    }
): Promise<Options> {
  const current = getInstanceContext()?.storybook;
  if (current) {
    return { ...current.options, docs: options.docs };
  }
  // Left open: the returned `presets` apply against this instance's hooks.
  const storybook = createStorybook({
    configDir: options.configDir,
    mode: 'headless',
    cliOptions: options,
  });
  await storybook.ready();
  return { ...options, ...storybook.options, docs: options.docs } as Options;
}
