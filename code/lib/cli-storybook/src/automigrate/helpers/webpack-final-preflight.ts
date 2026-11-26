import { logger, prompt } from 'storybook/internal/node-logger';
import { dedent } from 'ts-dedent';

import type { StorybookConfigRaw } from 'storybook/internal/types';

const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

/**
 * Whether the parsed main config declares a `webpackFinal` hook: a Webpack-specific API that does
 * not carry over to Vite. Detection reads the config object, so anything but a real hook (for
 * example one commented out) stays undetected.
 */
export const hasActiveWebpackFinal = (mainConfig: StorybookConfigRaw | undefined): boolean =>
  !!mainConfig && 'webpackFinal' in mainConfig && !!mainConfig.webpackFinal;

export interface WebpackFinalPreflightOptions {
  hasWebpackFinal: boolean;
  yes: boolean;
  /** How a cancelled migration tells the user to retry, e.g. its own automigrate command. */
  retryInstruction: string;
}

/**
 * Shared preflight of the Webpack-to-Vite fixes: a `webpackFinal` hook does not carry over to
 * Vite, so the user must port it to `viteFinal` first. Confirmed interactively (default No); under
 * `--yes` the box is logged and the migration skips. Resolves false when the migration must stop.
 */
export const confirmWebpackFinalCarryover = async ({
  hasWebpackFinal,
  yes,
  retryInstruction,
}: WebpackFinalPreflightOptions): Promise<boolean> => {
  if (!hasWebpackFinal) {
    return true;
  }

  logger.logBox(dedent`
    We detected a \`webpackFinal\` hook in your Storybook main config.

    \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
    You will need to port it to \`viteFinal\` after the migration.
    See ${VITE_CONFIG_DOC_URL} for porting guidance.
  `);

  const shouldContinue =
    !yes &&
    (await prompt.confirm({
      message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
      initialValue: false,
    }));

  if (!shouldContinue) {
    logger.log(
      `Migration cancelled. Port your webpackFinal hook to viteFinal first, then run ${retryInstruction} again.`
    );
    return false;
  }

  return true;
};
