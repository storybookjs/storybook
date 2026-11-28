import { DesignExportError } from 'storybook/internal/server-errors';
import { logger } from 'storybook/internal/node-logger';

import { type Command, InvalidArgumentError, Option } from 'commander';

export type ExportOptions = {
  format: 'claude-design';
  url: string;
  outputFile: string;
  width: number;
  height: number;
  timeout: number;
};

const positiveInteger = (max: number) => (value: string) => {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new InvalidArgumentError(`Expected an integer from 1 to ${max}.`);
  }
  return number;
};

export function storybookBaseURL(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidArgumentError('Expected an absolute HTTP or HTTPS Storybook URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new InvalidArgumentError(
      'Use an HTTP or HTTPS Storybook URL without embedded credentials.'
    );
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/(?:index|iframe)\.html$/, '/');
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url.href;
}

export function registerExportCommand(command: Command): void {
  command
    .description('Export a Storybook library as editable design artboards')
    .addOption(
      new Option('--format <format>', 'Design export format')
        .choices(['claude-design'])
        .makeOptionMandatory()
    )
    .requiredOption('--url <url>', 'Running or hosted Storybook URL', storybookBaseURL)
    .option(
      '--output-file <file>',
      'New ZIP archive to create (never overwritten)',
      'storybook-design.zip'
    )
    .option('--width <pixels>', 'Rendering viewport width', positiveInteger(16384), 1280)
    .option('--height <pixels>', 'Rendering viewport height', positiveInteger(16384), 800)
    .option('--timeout <milliseconds>', 'Maximum time per story', positiveInteger(600000), 30000)
    .action(async (options: ExportOptions) => {
      const controller = new AbortController();
      const cancel = () =>
        controller.abort(new DesignExportError({ message: 'Export cancelled.' }));
      process.once('SIGINT', cancel);
      process.once('SIGTERM', cancel);
      try {
        const { runExport } = await import('./run.ts');
        await runExport(options, controller.signal);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = controller.signal.aborted ? 130 : 1;
      } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
      }
    });
}
