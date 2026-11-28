import { parseList } from 'storybook/internal/common';
import { deprecate, logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import type { Command } from 'commander';

import { dev } from '../cli/dev.ts';
import { resolveDevCommandOptions } from './dev-options.ts';

/**
 * Registers the `dev` command on the core CLI.
 *
 * Extracted from core.ts so bin tests can exercise the real option declarations and action with an
 * in-process Commander program: core.ts parses `process.argv` at import time and cannot be imported
 * in a test process.
 */
export const registerDevCommand = (
  command: (name: string) => Command,
  handleCommandFailure: (logFilePath: string | boolean) => Promise<never>
): Command =>
  command('dev')
    .option('-p, --port <number>', 'Port to run Storybook')
    .option('-h, --host <string>', 'Host to run Storybook')
    .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
    .option(
      '--https',
      'Serve Storybook over HTTPS. Note: You must provide your own certificate information.'
    )
    .option(
      '--ssl-ca <ca>',
      'Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate)',
      parseList
    )
    .option('--ssl-cert <cert>', 'Provide an SSL certificate. (Required with --https)')
    .option('--ssl-key <key>', 'Provide an SSL key. (Required with --https)')
    .option('--smoke-test', 'Exit after successful start')
    .option('--ci', "CI mode (skip interactive prompts, don't open browser)")
    .option('--open', 'Open Storybook automatically in the browser', false)
    // Removed in Storybook 11 (PR #36395). Declared as the negation of `--open` so scripts still
    // passing `--no-open` parse cleanly and resolve to `open: false` — already the default —
    // instead of dying in Commander with `error: unknown option '--no-open'`.
    .option('--no-open', 'Removed in Storybook 11 — ignored with a warning')
    .option('--quiet', 'Suppress verbose build output')
    .option('--no-version-updates', 'Suppress update check', true)
    .option('--debug-webpack', 'Display final webpack configurations for debugging purposes')
    .option(
      '--webpack-stats-json [directory]',
      'Write Webpack stats JSON to disk (synonym for `--stats-json`)'
    )
    .option('--stats-json [directory]', 'Write stats JSON to disk')
    .option('--docs', 'Build a documentation-only site using addon-docs')
    .option('--exact-port', 'Exit early if the desired port is not available')
    .option(
      '--initial-path [path]',
      'URL path to be appended when visiting Storybook for the first time'
    )
    .option('--preview-only', 'Use the preview without the manager UI')
    .hook('preAction', () => {
      // `--no-open` collapses into the same `open` attribute as `--open`, so the resolved options
      // cannot tell "flag given" from the default. Only `dev` declares the flag, so a parse that
      // succeeded while `--no-open` is still in argv is a `storybook dev` invocation.
      if (process.argv.includes('--no-open')) {
        deprecate(dedent`
          The \`--no-open\` flag was removed in Storybook 11. Browser opening is now opt-in via \`--open\`.
          Ignoring the flag and continuing without opening a browser.
        `);
      }
    })
    .action(async (options) => {
      const { default: packageJson } = await import('storybook/package.json', {
        with: { type: 'json' },
      });

      logger.intro(`${packageJson.name} v${packageJson.version}`);

      let resolvedOptions: typeof options;
      try {
        resolvedOptions = resolveDevCommandOptions(options);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        return handleCommandFailure(options.logfile);
      }

      await dev({ ...resolvedOptions, packageJson }).catch(() => {
        handleCommandFailure(options.logfile);
      });
    });
