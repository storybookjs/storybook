import * as fs from 'node:fs/promises';

import type { StoryIndex } from '@storybook/core/internal/types';

import { fs as memoryFs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import { StoryScreenshotBrowserUnavailableError } from '../../../../server-errors.ts';
import { invokeToolsetMethod } from '../../toolset-definition.ts';
import { createStoriesToolset } from './definition.ts';
import type { StoryRenderAccess, StoryScreenshotResult } from './screenshot-stories.ts';

vi.mock('node:fs/promises', { spy: true });

const index = {
  v: 5,
  entries: Object.fromEntries(
    ['primary', 'broken', 'play', 'slow'].map((name) => [
      `button--${name}`,
      {
        type: 'story',
        subtype: 'story',
        id: `button--${name}`,
        name,
        title: 'Button',
        importPath: './src/Button.stories.tsx',
        tags: ['story'],
      },
    ])
  ),
} as StoryIndex;

const RESULTS: Record<string, Omit<StoryScreenshotResult, 'path'>> = {
  'button--broken': { status: 'errored', error: 'Boom', consoleErrors: ['Boom'] },
  'button--play': { status: 'play-failed', error: 'expected 1 to be 2', consoleErrors: [] },
  'button--slow': { status: 'timeout', error: 'Did not finish', consoleErrors: [] },
};

const access: StoryRenderAccess = {
  screenshot: vi.fn(async (request) => ({
    path: request.path,
    ...(RESULTS[request.storyId] ?? { status: 'rendered', consoleErrors: [] }),
  })),
};

async function run(
  input: Record<string, unknown>,
  {
    renderAccess = access,
    origin,
    signal,
  }: { renderAccess?: StoryRenderAccess | null; origin?: string; signal?: AbortSignal } = {}
) {
  const toolset = createStoriesToolset({
    storyIndex: { getIndex: async () => index },
    git: { getRepoRoot: vi.fn(), getChangedFiles: vi.fn() },
    changeStatuses: { getAll: () => ({}) },
    storybookDirs: { configDir: '/repo/.storybook', getStaticDirs: async () => [] },
    storyRender: { get: async () => renderAccess ?? undefined },
  });
  const outcome = await invokeToolsetMethod(
    toolset,
    'screenshot',
    v.parse(toolset.methods.screenshot.input, input),
    {
      transport: 'cli',
      getService: vi.fn(),
      ...(origin ? { origin } : {}),
      ...(signal ? { signal } : {}),
    }
  );
  return {
    requests: vi.mocked(access.screenshot).mock.calls.map(([request]) => request),
    outcome,
  };
}

beforeEach(() => {
  vol.reset();
  vi.mocked(access.screenshot).mockClear();
  vi.mocked(fs.mkdir).mockImplementation(memoryFs.promises.mkdir as typeof fs.mkdir);
});

describe('stories.screenshot', () => {
  it('screenshots a story against the known origin', async () => {
    expect(
      await run(
        { stories: [{ storyId: 'button--primary' }], outDir: '/shots' },
        { origin: 'http://localhost:6006/' }
      )
    ).toMatchInlineSnapshot(`
      {
        "outcome": {
          "data": {
            "stories": [
              {
                "consoleErrors": [],
                "path": "/shots/button--primary.png",
                "status": "rendered",
                "storyId": "button--primary",
                "viewport": {
                  "height": 720,
                  "width": 1280,
                },
              },
            ],
          },
          "images": [
            {
              "mimeType": "image/png",
              "path": "/shots/button--primary.png",
            },
          ],
          "markdown": [
            "button--primary: rendered (1280x720)
      Screenshot: /shots/button--primary.png",
          ],
          "ok": true,
          "telemetry": {
            "event": "tool:stories_screenshot",
            "payload": {
              "inputStoryCount": 1,
              "renderedStoryCount": 1,
            },
            "tool": "screenshot",
            "toolset": "stories",
          },
        },
        "requests": [
          {
            "iframePath": "iframe.html?id=button--primary&viewMode=story",
            "origin": "http://localhost:6006/",
            "path": "/shots/button--primary.png",
            "storyId": "button--primary",
            "timeoutMs": 15000,
            "viewport": {
              "height": 720,
              "width": 1280,
            },
          },
        ],
      }
    `);
  });

  it('leaves the origin to the renderer when none is known', async () => {
    expect(await run({ stories: [{ storyId: 'button--primary' }], outDir: '/shots' }))
      .toMatchInlineSnapshot(`
      {
        "outcome": {
          "data": {
            "stories": [
              {
                "consoleErrors": [],
                "path": "/shots/button--primary.png",
                "status": "rendered",
                "storyId": "button--primary",
                "viewport": {
                  "height": 720,
                  "width": 1280,
                },
              },
            ],
          },
          "images": [
            {
              "mimeType": "image/png",
              "path": "/shots/button--primary.png",
            },
          ],
          "markdown": [
            "button--primary: rendered (1280x720)
      Screenshot: /shots/button--primary.png",
          ],
          "ok": true,
          "telemetry": {
            "event": "tool:stories_screenshot",
            "payload": {
              "inputStoryCount": 1,
              "renderedStoryCount": 1,
            },
            "tool": "screenshot",
            "toolset": "stories",
          },
        },
        "requests": [
          {
            "iframePath": "iframe.html?id=button--primary&viewMode=story",
            "path": "/shots/button--primary.png",
            "storyId": "button--primary",
            "timeoutMs": 15000,
            "viewport": {
              "height": 720,
              "width": 1280,
            },
          },
        ],
      }
    `);
  });

  it('reports an unknown story per input and still screenshots the known one', async () => {
    expect(
      await run({
        stories: [{ storyId: 'button--primray' }, { storyId: 'button--primary' }],
        outDir: '/shots',
      })
    ).toMatchInlineSnapshot(`
      {
        "outcome": {
          "data": {
            "stories": [
              {
                "error": "No story found for story ID "button--primray". Did you mean "button--primary", "button--play", "button--broken"?",
                "input": {
                  "storyId": "button--primray",
                },
              },
              {
                "consoleErrors": [],
                "path": "/shots/button--primary.png",
                "status": "rendered",
                "storyId": "button--primary",
                "viewport": {
                  "height": 720,
                  "width": 1280,
                },
              },
            ],
          },
          "images": [
            {
              "mimeType": "image/png",
              "path": "/shots/button--primary.png",
            },
          ],
          "markdown": [
            "No story found for story ID "button--primray". Did you mean "button--primary", "button--play", "button--broken"?",
            "button--primary: rendered (1280x720)
      Screenshot: /shots/button--primary.png",
          ],
          "ok": false,
          "telemetry": {
            "event": "tool:stories_screenshot",
            "payload": {
              "inputStoryCount": 2,
              "renderedStoryCount": 1,
            },
            "tool": "screenshot",
            "toolset": "stories",
          },
        },
        "requests": [
          {
            "iframePath": "iframe.html?id=button--primary&viewMode=story",
            "path": "/shots/button--primary.png",
            "storyId": "button--primary",
            "timeoutMs": 15000,
            "viewport": {
              "height": 720,
              "width": 1280,
            },
          },
        ],
      }
    `);
  });

  it('reports every failing render status', async () => {
    expect(
      await run({
        stories: [
          { storyId: 'button--broken' },
          { storyId: 'button--play' },
          { storyId: 'button--slow' },
        ],
        outDir: '/shots',
        viewport: { width: 400, height: 300 },
      })
    ).toMatchInlineSnapshot(`
      {
        "outcome": {
          "data": {
            "stories": [
              {
                "consoleErrors": [
                  "Boom",
                ],
                "error": "Boom",
                "path": "/shots/button--broken.png",
                "status": "errored",
                "storyId": "button--broken",
                "viewport": {
                  "height": 300,
                  "width": 400,
                },
              },
              {
                "consoleErrors": [],
                "error": "expected 1 to be 2",
                "path": "/shots/button--play.png",
                "status": "play-failed",
                "storyId": "button--play",
                "viewport": {
                  "height": 300,
                  "width": 400,
                },
              },
              {
                "consoleErrors": [],
                "error": "Did not finish",
                "path": "/shots/button--slow.png",
                "status": "timeout",
                "storyId": "button--slow",
                "viewport": {
                  "height": 300,
                  "width": 400,
                },
              },
            ],
          },
          "images": [
            {
              "mimeType": "image/png",
              "path": "/shots/button--broken.png",
            },
            {
              "mimeType": "image/png",
              "path": "/shots/button--play.png",
            },
            {
              "mimeType": "image/png",
              "path": "/shots/button--slow.png",
            },
          ],
          "markdown": [
            "button--broken: errored (400x300)
      Screenshot: /shots/button--broken.png
      Error: Boom
      Console errors:
      - Boom",
            "button--play: play-failed (400x300)
      Screenshot: /shots/button--play.png
      Error: expected 1 to be 2",
            "button--slow: timeout (400x300)
      Screenshot: /shots/button--slow.png
      Error: Did not finish",
          ],
          "ok": false,
          "telemetry": {
            "event": "tool:stories_screenshot",
            "payload": {
              "inputStoryCount": 3,
              "renderedStoryCount": 0,
            },
            "tool": "screenshot",
            "toolset": "stories",
          },
        },
        "requests": [
          {
            "iframePath": "iframe.html?id=button--broken&viewMode=story",
            "path": "/shots/button--broken.png",
            "storyId": "button--broken",
            "timeoutMs": 15000,
            "viewport": {
              "height": 300,
              "width": 400,
            },
          },
          {
            "iframePath": "iframe.html?id=button--play&viewMode=story",
            "path": "/shots/button--play.png",
            "storyId": "button--play",
            "timeoutMs": 15000,
            "viewport": {
              "height": 300,
              "width": 400,
            },
          },
          {
            "iframePath": "iframe.html?id=button--slow&viewMode=story",
            "path": "/shots/button--slow.png",
            "storyId": "button--slow",
            "timeoutMs": 15000,
            "viewport": {
              "height": 300,
              "width": 400,
            },
          },
        ],
      }
    `);
  });

  it('renders args and globals, and names a repeated story apart', async () => {
    expect(
      await run({
        stories: [
          { storyId: 'button--primary' },
          { storyId: 'button--primary', props: { label: 'Hi' }, globals: { theme: 'dark' } },
        ],
        outDir: '/shots',
        timeoutMs: 500,
      })
    ).toMatchInlineSnapshot(`
      {
        "outcome": {
          "data": {
            "stories": [
              {
                "consoleErrors": [],
                "path": "/shots/button--primary.png",
                "status": "rendered",
                "storyId": "button--primary",
                "viewport": {
                  "height": 720,
                  "width": 1280,
                },
              },
              {
                "consoleErrors": [],
                "path": "/shots/button--primary-2.png",
                "status": "rendered",
                "storyId": "button--primary",
                "viewport": {
                  "height": 720,
                  "width": 1280,
                },
              },
            ],
          },
          "images": [
            {
              "mimeType": "image/png",
              "path": "/shots/button--primary.png",
            },
            {
              "mimeType": "image/png",
              "path": "/shots/button--primary-2.png",
            },
          ],
          "markdown": [
            "button--primary: rendered (1280x720)
      Screenshot: /shots/button--primary.png",
            "button--primary: rendered (1280x720)
      Screenshot: /shots/button--primary-2.png",
          ],
          "ok": true,
          "telemetry": {
            "event": "tool:stories_screenshot",
            "payload": {
              "inputStoryCount": 2,
              "renderedStoryCount": 2,
            },
            "tool": "screenshot",
            "toolset": "stories",
          },
        },
        "requests": [
          {
            "iframePath": "iframe.html?id=button--primary&viewMode=story",
            "path": "/shots/button--primary.png",
            "storyId": "button--primary",
            "timeoutMs": 500,
            "viewport": {
              "height": 720,
              "width": 1280,
            },
          },
          {
            "iframePath": "iframe.html?id=button--primary&viewMode=story&args=label:Hi&globals=theme:dark",
            "path": "/shots/button--primary-2.png",
            "storyId": "button--primary",
            "timeoutMs": 500,
            "viewport": {
              "height": 720,
              "width": 1280,
            },
          },
        ],
      }
    `);
  });

  it('needs a story renderer', async () => {
    await expect(
      run({ stories: [{ storyId: 'button--primary' }] }, { renderAccess: null })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[SB_CORE-COMMON_0033 (StoryRenderUnavailableError): Taking story screenshots needs a preview builder, which this Storybook host does not provide. Install the \`storybook\` package next to your framework, or run the tool against a running Storybook.]`
    );
  });

  it('surfaces a missing browser from the renderer', async () => {
    const renderAccess: StoryRenderAccess = {
      screenshot: async () => {
        throw new StoryScreenshotBrowserUnavailableError({
          reason: 'neither `playwright-core` nor `playwright` is installed.',
        });
      },
    };
    await expect(
      run({ stories: [{ storyId: 'button--primary' }], outDir: '/shots' }, { renderAccess })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      [SB_CORE-COMMON_0034 (StoryScreenshotBrowserUnavailableError): Taking story screenshots needs a headless Chromium: neither \`playwright-core\` nor \`playwright\` is installed.
      Install it in the project with \`npm install -D playwright\` and \`npx playwright install chromium\`, then retry.]
    `);
  });

  it('hands the call signal to the renderer and stops before the next story once it aborts', async () => {
    const controller = new AbortController();
    const signals: Array<AbortSignal | undefined> = [];
    const renderAccess: StoryRenderAccess = {
      screenshot: async (request, options) => {
        signals.push(options?.signal);
        controller.abort(new Error('cancelled'));
        return { status: 'rendered', path: request.path, consoleErrors: [] };
      },
    };
    const stories = ['primary', 'broken', 'play', 'slow', 'primary'].map((name) => ({
      storyId: `button--${name}`,
    }));

    await expect(
      run({ stories, outDir: '/shots' }, { renderAccess, signal: controller.signal })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: cancelled]`);
    expect(signals).toEqual([controller.signal]);
  });
});
