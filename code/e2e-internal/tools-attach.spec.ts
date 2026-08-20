import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

/**
 * Attach coverage for `storybook tools --attach` against the internal Storybook UI.
 *
 * Run locally (from repo root) with internal Storybook on port 6006:
 *   cd code && yarn storybook:ui
 *   yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts
 */

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const codeDir = join(here, '..');
const dispatcher = join(codeDir, 'core/dist/bin/dispatcher.js');

async function runTools(args: string[], cwd = codeDir) {
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
    const list = await runTools(['--attach', 'docs', 'list', '--json']);
    expect(list.exitCode, list.output).toBe(0);
    const parsed = JSON.parse(list.output) as {
      manifests?: { componentManifest?: { components?: Record<string, { id?: string }> } };
    };
    const docsId = Object.keys(parsed.manifests?.componentManifest?.components ?? {})[0];
    expect(docsId).toBeTruthy();

    const show = await runTools(['--attach', 'docs', 'show', '--id', docsId]);
    expect(show.exitCode, show.output).toBe(0);
    expect(show.output.length).toBeGreaterThan(0);

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
