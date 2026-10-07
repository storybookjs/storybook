import { execFile } from 'child_process';
import { join } from 'path';
import process from 'process';
import { promisify } from 'util';

import { expect, type Page } from '@playwright/test';

/** Internal Storybook UI can take a while to compile the first preview story on cold start. */
export const PREVIEW_STORY_TIMEOUT = 30_000;

/** Waits until the manager preview shell has finished loading the selected story. */
export async function waitForPreviewReady(page: Page): Promise<void> {
  await expect(page.getByRole('progressbar', { name: 'Content is loading...' })).toBeHidden({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
}

const execFileAsync = promisify(execFile);
const dispatcher = join(process.cwd(), 'core/dist/bin/dispatcher.js');
export const runsAgainstDevServer = !['build', 'static'].includes(
  process.env.STORYBOOK_TYPE || 'dev'
);

export async function runTools(
  args: string[],
  cwd = process.cwd(),
  extraEnv: NodeJS.ProcessEnv = {}
) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [dispatcher, 'tools', ...args],
      {
        cwd,
        env: {
          ...process.env,
          STORYBOOK_DISABLE_TELEMETRY: '1',
          ...extraEnv,
        },
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}
