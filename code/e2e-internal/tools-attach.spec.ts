import { execFile } from 'child_process';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import process from 'process';

import { expect, test } from '@playwright/test';

/**
 * Attach coverage for `storybook tools` against the internal Storybook UI.
 *
 * Run locally (from repo root) with internal Storybook on port 6006:
 *   cd code && yarn storybook:ui
 *   yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts
 */

const execFileAsync = promisify(execFile);
const dispatcher = join(process.cwd(), 'core/dist/bin/dispatcher.js');
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

async function runTools(args: string[], cwd = process.cwd(), extraEnv: NodeJS.ProcessEnv = {}) {
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

const REVIEW_INPUT = JSON.stringify({
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
});

test.describe('storybook tools attach', () => {
  // Declaration order matters (the full-extraction test must stay last — see its comment), which
  // the config's fullyParallel would not preserve outside CI's single worker. Not 'serial': these
  // tests are independent, so one failure must not skip the rest.
  test.describe.configure({ mode: 'default' });
  test.setTimeout(90_000);

  test('fails with start-Storybook guidance when --attach finds no instance', async () => {
    const result = await runTools(['--attach', '--cwd', '/tmp/storybook-tools-attach-no-instance']);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('npm run storybook');
    expect(result.output).toContain('--attach');
    expect(result.output).not.toContain('Falling back');
  });

  test('auto mode attaches for docs, preview, review, and stories changed against the running internal UI', async () => {
    test.skip(
      !runsAgainstDevServer,
      'Live attach requires the running Storybook channel, which the static E2E job does not serve.'
    );
    const list = await runTools(['docs', 'list']);
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');
    expect(list.output).not.toContain('Falling back');

    const show = await runTools(['docs', 'show', '--id', 'example-button']);
    expect(show.exitCode, show.output).toBe(0);
    expect(show.output).toContain('label');

    const preview = await runTools([
      'stories',
      'preview',
      '--stories',
      '[{"storyId":"core-basics--basic"}]',
    ]);
    expect(preview.exitCode, preview.output).toBe(0);
    expect(preview.output).toContain('http://');

    const review = await runTools(['review', 'create', '--input', REVIEW_INPUT]);
    expect(review.exitCode, review.output).toBe(0);

    const changed = await runTools(['stories', 'changed']);
    expect(changed.exitCode, changed.output).toBe(0);
    expect(changed.output).not.toContain('Falling back');
  });

  test('--attach still joins the running internal UI', async () => {
    test.skip(
      !runsAgainstDevServer,
      'Live attach requires the running Storybook channel, which the static E2E job does not serve.'
    );
    const list = await runTools(['--attach', 'docs', 'list']);
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');
  });

  test('--no-attach forces local and intercepts requiresDevServer tools', async () => {
    const list = await runTools(['--no-attach', 'docs', 'list']);
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');

    const preview = await runTools([
      '--no-attach',
      'stories',
      'preview',
      '--stories',
      '[{"storyId":"core-basics--basic"}]',
    ]);
    expect(preview.exitCode).not.toBe(0);
    expect(preview.output).toMatch(/--no-attach|requires a running Storybook/);
  });

  test('auto mode falls back to local silently when no instance matches', async () => {
    const emptyHome = join(tmpdir(), `storybook-tools-attach-empty-home-${process.pid}`);
    await mkdir(emptyHome, { recursive: true });
    const result = await runTools(['docs', 'list'], process.cwd(), { HOME: emptyHome });

    expect(result.exitCode, result.output).toBe(0);
    expect(result.output).toContain('example-button');
    expect(result.output).not.toContain('Falling back');
    expect(result.output).not.toContain('npm run storybook');
  });

  test('--no-attach from a different cwd loads via a project-local child host', async () => {
    const list = await runTools(
      ['--no-attach', '--cwd', process.cwd(), 'docs', 'list'],
      join(process.cwd(), '..')
    );
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');
  });

  test('attaches from a different cwd via a project-local child host', async () => {
    test.skip(
      !runsAgainstDevServer,
      'Child-host attach requires the running Storybook channel, which the static E2E job does not serve.'
    );
    const list = await runTools(
      ['--cwd', process.cwd(), 'docs', 'list'],
      join(process.cwd(), '..')
    );
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');
  });

  // Deliberately last: the first-ever full extraction leaves the instance holding (and syncing to
  // later clients) an all-components state large enough to grind a small CI box, which failed the
  // unrelated attach test that used to follow it. Tracked in #36105.
  test('attached docs list succeeds through the instance docgen services', async ({ page }) => {
    test.skip(
      !runsAgainstDevServer,
      'Live attach requires the running Storybook channel, which the static E2E job does not serve.'
    );
    await page.goto(process.env.STORYBOOK_URL || 'http://localhost:6006');
    const docgenServerEnabled = await page.evaluate(() =>
      Boolean(
        (globalThis as { FEATURES?: { experimentalDocgenServer?: boolean } }).FEATURES
          ?.experimentalDocgenServer
      )
    );
    test.skip(
      !docgenServerEnabled,
      'Requires the internal Storybook started with STORYBOOK_EXPERIMENTAL_DOCGEN_SERVER=true, as CI does.'
    );
    // Every per-component extraction broadcasts the full accumulated docgen state to each channel
    // client, so leave the manager page before fanning out to spare the CI dev server that load.
    await page.goto('about:blank');

    // The env var makes the CLI's own config evaluation register the docgen services, so listing
    // delegates the all-components extraction to the instance instead of reading local manifests.
    const list = await runTools(['--attach', 'docs', 'list'], process.cwd(), {
      STORYBOOK_EXPERIMENTAL_DOCGEN_SERVER: 'true',
    });
    expect(list.exitCode, list.output).toBe(0);
    expect(list.output).toContain('example-button');
  });
});
