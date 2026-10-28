import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { Server } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { join } from 'pathe';

import { invokeToolsetMethod } from '@storybook/core/internal/deep/shared/open-service/toolset-definition';
import { createStorybook, defineAddon, type Storybook } from 'storybook/internal/instance';

import fixtureMain from './__fixtures__/screenshot/.storybook/main.ts';
import { createStoryScreenshotAccess, type StoryScreenshotAccess } from './story-screenshot.ts';

vi.unmock('@storybook/core/internal/node-logger');

const WORKING_DIR = fileURLToPath(new URL('./__fixtures__/screenshot', import.meta.url));
const PNG_MAGIC = '89504e470d0a1a0a';

let storybook: Storybook;
let outDir: string;
let chromiumUnavailable: string | undefined;
let access: StoryScreenshotAccess | undefined;

/** Swaps in the access under test; registered last, so it wins the reduce. */
const renderAccessOverride = defineAddon(() => ({
  meta: { name: 'screenshot-test-render-access' },
  setup(instance: Storybook): void {
    instance.hook('core:story-render:extend', (value) => access ?? value);
  },
}))();

beforeAll(async () => {
  try {
    const { chromium } = await import('playwright-core');
    await (await chromium.launch({ headless: true })).close();
  } catch (error) {
    chromiumUnavailable = error instanceof Error ? error.message : String(error);
  }
  outDir = await mkdtemp(join(tmpdir(), 'storybook-screenshot-test-'));
  // The Vite builder resolves story import paths against the process directory.
  vi.spyOn(process, 'cwd').mockReturnValue(WORKING_DIR);
  storybook = await createStorybook({
    workingDir: WORKING_DIR,
    configDir: '.storybook',
    mode: 'headless',
    main: { ...fixtureMain, addons: [renderAccessOverride] },
  });
}, 60_000);

afterAll(async () => {
  await access?.close();
  await storybook?.close();
  await rm(outDir, { recursive: true, force: true });
  vi.restoreAllMocks();
}, 60_000);

function screenshot(storyIds: string[]) {
  return invokeToolsetMethod(
    storybook.toolsets.get('stories'),
    'screenshot',
    { stories: storyIds.map((storyId) => ({ storyId })), outDir, timeoutMs: 15_000 },
    { transport: 'sdk', getService: () => undefined as never }
  );
}

/** Count Chromium processes this test process spawned; Windows has no `ps`. */
function chromiumChildren(): number {
  if (process.platform === 'win32') {
    return 0;
  }
  return execFileSync('ps', ['-A', '-o', 'ppid=,comm='], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => {
      const [ppid, ...command] = line.trim().split(/\s+/);
      return Number(ppid) === process.pid && /chrom/i.test(command.join(' '));
    }).length;
}

describe.each([
  { transport: 'port', expected: { listened: true } },
  { transport: 'in-process', expected: { listened: false } },
] as const)('stories.screenshot over the $transport transport', ({ transport, expected }) => {
  it('hosts the preview and screenshots each story with its render status', async (context) => {
    if (chromiumUnavailable) {
      context.skip(`Chromium cannot launch: ${chromiumUnavailable}`);
    }
    await access?.close();
    access = createStoryScreenshotAccess(storybook, { transport });
    const callHook = vi.spyOn(storybook, 'callHook');
    const listen = vi.spyOn(Server.prototype, 'listen');
    try {
      const first = await screenshot(['box--filled']);
      const rest = await screenshot(['box--filled', 'box--broken', 'box--play-fails']);
      const listened = listen.mock.calls.length > 0;
      const chromiumWhileOpen = chromiumChildren() > 0;
      await access.close();

      expect(callHook.mock.calls.map(([name]) => name)).not.toContain('server:app:extend');
      expect({
        listened,
        chromiumWhileOpen: chromiumWhileOpen || process.platform === 'win32',
        chromiumAfterClose: chromiumChildren(),
      }).toEqual({ ...expected, chromiumWhileOpen: true, chromiumAfterClose: 0 });

      const stories = [...first.data.stories, ...rest.data.stories];
      const observed = await Promise.all(
        stories.map(
          async (story: {
            storyId: string;
            status: string;
            error?: string;
            path?: string;
            consoleErrors: string[];
          }) => ({
            storyId: story.storyId,
            status: story.status,
            error: story.error,
            // Equal across transports: an in-process socket or request failure would surface here.
            consoleErrors: story.consoleErrors,
            png: story.path
              ? (await readFile(story.path)).subarray(0, 8).toString('hex') === PNG_MAGIC
              : false,
          })
        )
      );
      expect({ ok: [first.ok, rest.ok], observed }).toMatchInlineSnapshot(`
        {
          "observed": [
            {
              "consoleErrors": [],
              "error": undefined,
              "png": true,
              "status": "rendered",
              "storyId": "box--filled",
            },
            {
              "consoleErrors": [],
              "error": undefined,
              "png": true,
              "status": "rendered",
              "storyId": "box--filled",
            },
            {
              "consoleErrors": [
                "Box cannot render",
                "The above error occurred in the <hookified> component:",
                "Error rendering story 'box--broken':",
                "Error: Box cannot render",
              ],
              "error": "Box cannot render",
              "png": true,
              "status": "errored",
              "storyId": "box--broken",
            },
            {
              "consoleErrors": [
                "Error: Play went wrong",
              ],
              "error": "Play went wrong",
              "png": true,
              "status": "play-failed",
              "storyId": "box--play-fails",
            },
          ],
          "ok": [
            true,
            false,
          ],
        }
      `);
    } finally {
      listen.mockRestore();
      callHook.mockRestore();
    }
  }, 120_000);
});
