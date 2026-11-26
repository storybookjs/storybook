import { logger, prompt } from 'storybook/internal/node-logger';
import { dedent } from 'ts-dedent';

import type { FixFiles } from '../fix-files.ts';

const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

/**
 * Comment-stripped view of a config source, so a commented-out hook is not detected as active.
 * Quotes are tracked so a `//` inside a string literal (a URL, say) is not read as a comment; a
 * small scanner keeps this dependency-free.
 */
const stripComments = (source: string): string => {
  let stripped = '';
  let quote: string | null = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quote) {
      stripped += char;
      if (char === '\\') {
        stripped += next ?? '';
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      stripped += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        i += 1;
      }
      i -= 1; // the loop's increment re-reads the newline
      continue;
    }
    if (char === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        i += 1;
      }
      i += 1; // consume the closing `*`; the loop's increment consumes the `/`
      stripped += ' ';
      continue;
    }
    stripped += char;
  }
  return stripped;
};

/**
 * Whether the main config declares an active `webpackFinal` hook, judged on a comment-stripped
 * read: a commented-out hook will not carry over to Vite, so it must not trigger the preflight.
 */
export const hasActiveWebpackFinal = async (
  files: Pick<FixFiles, 'read'>,
  mainConfigPath: string | undefined
): Promise<boolean> =>
  !!mainConfigPath && stripComments(await files.read(mainConfigPath)).includes('webpackFinal');

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
