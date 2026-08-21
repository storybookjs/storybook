import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import process from 'process';

import { expect, test } from '@playwright/test';

/**
 * Attach coverage for `storybook tools --attach` against the internal Storybook UI.
 *
 * Run locally (from repo root) with internal Storybook on port 6006:
 *   cd code && yarn storybook:ui
 *   yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts
 */

const execFileAsync = promisify(execFile);
const dispatcher = join(process.cwd(), 'core/dist/bin/dispatcher.js');
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

async function runTools(args: string[], cwd = process.cwd()) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [dispatcher, 'tools', ...args],
      {
        cwd,
        env: {
          ...process.env,
          STORYBOOK_DISABLE_TELEMETRY: '1',
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

test.describe('storybook tools --attach', () => {
  test.setTimeout(90_000);

  test('fails with start-Storybook guidance when no instance matches', async () => {
    const result = await runTools(['--attach', '--cwd', '/tmp/storybook-tools-attach-no-instance']);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('npm run storybook');
    expect(result.output).toContain('--attach');
  });

  test('docs show, stories preview, and review create against the running internal UI', async () => {
    test.skip(
      !runsAgainstDevServer,
      'Live attach requires the running Storybook channel, which the static E2E job does not serve.'
    );
    const list = await runTools(['--attach', 'docs', 'list']);
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');

    const show = await runTools(['--attach', 'docs', 'show', '--id', 'example-button']);
    expect(show.exitCode, show.output).toBe(0);
    expect(show.output).toContain('label');

    const preview = await runTools([
      '--attach',
      'stories',
      'preview',
      '--stories',
      '[{"storyId":"core-basics--basic"}]',
    ]);
    expect(preview.exitCode, preview.output).toBe(0);
    expect(preview.output).toContain('http://');

    const review = await runTools([
      '--attach',
      'review',
      'create',
      '--input',
      JSON.stringify({
        title: 'Attach e2e',
        description: 'Spot-check attach.',
        collections: [
          {
            title: 'Basics',
            rationale: 'Internal UI story.',
            storyIds: ['core-basics--basic'],
          },
        ],
        changedFiles: [],
      }),
    ]);
    expect(review.exitCode, review.output).toBe(0);
  });
});
