/* eslint-disable local-rules/no-uncategorized-errors */
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { SANDBOX_DIRECTORY } from '../../scripts/utils/constants.ts';
import { SbPage } from './util.ts';

// End-to-end coverage for the in-file story rename-detection feature:
// - meta.title rename  → auto-redirect to the new story ID
// - export rename      → FollowupOverlay listing the new story as a sibling
// - file deletion      → FollowupOverlay with "This story was deleted" heading
// - export deletion    → FollowupOverlay listing the remaining siblings
//
// The spec creates one dedicated .stories file per scenario inside
// `<sandbox>/src/stories/rename-detection/`, drives it through HMR by writing
// over the file (or deleting it), and asserts the manager reacts correctly.
// afterAll removes every file we wrote and deletes the directory when empty.

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const storybookType = process.env.STORYBOOK_TYPE || 'dev';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || 'react-vite/default-ts';

// The rename-detection pipeline only runs in dev: the HMR watcher is the
// whole entry point. Static builds don't hit any of this code.
const isDev = storybookType === 'dev';

// Match the pattern used by storybook-hooks.spec.ts: read the sandbox
// location from SANDBOX_DIRECTORY (`../storybook-sandboxes/<template>` by
// default), with a hard override via `STORYBOOK_SANDBOX_DIR` if the runner
// has staged the sandbox somewhere unusual. The stories directory itself
// can also be overridden via `STORYBOOK_STORIES_DIR` for sandboxes whose
// stories root isn't `<sandbox>/src/stories`.
const sandboxDir =
  process.env.STORYBOOK_SANDBOX_DIR ||
  join(SANDBOX_DIRECTORY, templateName.replace('/', '-'));
const STORIES_ROOT = process.env.STORYBOOK_STORIES_DIR
  ? resolve(process.env.STORYBOOK_STORIES_DIR)
  : join(sandboxDir, 'src', 'stories');
const SCENARIOS_DIR = join(STORIES_ROOT, 'rename-detection');

// Track every file we touch so afterAll can clean up deterministically, even
// if a test fails mid-way through a scenario.
const createdFiles = new Set<string>();

/** Build a story ID exactly the way Storybook's `toId` does for the simple
 *  alphanumeric-kebab-case titles used in this spec — enough to predict URLs
 *  without dragging the CSF runtime into the test file. */
const buildStoryId = (title: string, exportName: string): string =>
  `${title.toLowerCase().replace(/\//g, '-')}--${exportName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;

type StoryShape = {
  title: string;
  exports: string[];
};

/** Emit a minimal CSF3 stories file. The component renders a small DOM node
 *  via `React.createElement` (no JSX, so we don't depend on the sandbox's
 *  TSX/JSX configuration) — that satisfies `SbPage.waitForStoryLoaded`,
 *  which waits for at least one element child inside `#storybook-root`. */
const renderStoriesSource = ({ title, exports }: StoryShape): string => {
  const exportBlocks = exports
    .map((name) => `export const ${name}: StoryObj<typeof Dummy> = {};`)
    .join('\n');
  return [
    "import * as React from 'react';",
    '',
    "import type { Meta, StoryObj } from '@storybook/react-vite';",
    '',
    "const Dummy = () => React.createElement('div', { 'data-testid': 'rd-target' }, 'hello');",
    '',
    'const meta: Meta<typeof Dummy> = {',
    `  title: '${title}',`,
    '  component: Dummy,',
    '};',
    '',
    'export default meta;',
    '',
    exportBlocks,
    '',
  ].join('\n');
};

const writeStoryFile = async (filePath: string, shape: StoryShape): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, renderStoriesSource(shape), 'utf8');
  createdFiles.add(filePath);
};

const deleteStoryFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  createdFiles.delete(filePath);
};

/** Poll the server's index.json until `predicate(entries)` is satisfied.
 *  The dev-server debounces re-indexing (~100ms watch batch + 100ms orchestrator
 *  debounce), so callers should allow a generous timeout. */
const waitForIndex = async (
  page: import('@playwright/test').Page,
  predicate: (entries: Record<string, unknown>) => boolean,
  message: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${storybookUrl}/index.json`);
        if (!response.ok()) {
          return false;
        }
        const index = (await response.json()) as { entries?: Record<string, unknown> };
        return predicate(index.entries ?? {});
      },
      {
        intervals: [200, 400, 800, 1500],
        message,
        timeout: 15_000,
      }
    )
    .toBe(true);
};

const waitForStoryId = (page: import('@playwright/test').Page, storyId: string) =>
  waitForIndex(
    page,
    (entries) => Boolean(entries[storyId]),
    `index.json should include story id "${storyId}"`
  );

const waitForStoryIdGone = (page: import('@playwright/test').Page, storyId: string) =>
  waitForIndex(
    page,
    (entries) => !entries[storyId],
    `index.json should no longer include story id "${storyId}"`
  );

/** Navigate to a story via `?path=` and wait for the preview to attach, so
 *  later edits operate on a story the manager has actually loaded. */
const openStoryByUrl = async (
  page: import('@playwright/test').Page,
  storyId: string
): Promise<SbPage> => {
  const sbPage = new SbPage(page, expect);
  await page.goto(`${storybookUrl}/?path=/story/${storyId}`);
  await page.waitForURL((url) => url.search.includes(`path=/story/${storyId}`));
  await sbPage.waitUntilLoaded();
  return sbPage;
};

test.describe('Story rename detection', () => {
  // Only run against the react-vite/default-ts sandbox — other sandboxes may
  // not have the same stories root, and the feature is renderer-agnostic so a
  // single template is enough to validate it end-to-end.
  test.skip(!isDev, 'Rename detection only runs in dev (no HMR in static build)');

  test.afterAll(async () => {
    for (const filePath of Array.from(createdFiles)) {
      try {
        await fs.unlink(filePath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          // eslint-disable-next-line no-console
          console.warn(`rename-detection cleanup: failed to remove ${filePath}:`, error);
        }
      }
      createdFiles.delete(filePath);
    }

    try {
      const remaining = await fs.readdir(SCENARIOS_DIR);
      if (remaining.length === 0) {
        await fs.rmdir(SCENARIOS_DIR);
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.warn(`rename-detection cleanup: failed to rmdir ${SCENARIOS_DIR}:`, error);
      }
    }
  });

  test('meta.title rename auto-redirects to the new story ID', async ({ page }) => {
    const filePath = join(SCENARIOS_DIR, 'meta-title.stories.tsx');
    const beforeTitle = 'rd/mt-before';
    const afterTitle = 'rd/mt-after';
    const beforeId = buildStoryId(beforeTitle, 'Primary');
    const afterId = buildStoryId(afterTitle, 'Primary');

    await writeStoryFile(filePath, { title: beforeTitle, exports: ['Primary'] });
    await waitForStoryId(page, beforeId);

    await openStoryByUrl(page, beforeId);

    // Trigger the rename — same file, same export, new title.
    await writeStoryFile(filePath, { title: afterTitle, exports: ['Primary'] });
    await waitForStoryId(page, afterId);

    // The manager's setIndex synchronously consults renameRedirectStore.chains
    // and calls api.selectStory(newId) when the chain resolves, so the URL
    // should flip to the renamed story without any overlay in between.
    await page.waitForURL(
      (url) => url.search.includes(`path=/story/${afterId}`),
      { timeout: 15_000 }
    );

    const followup = page.getByRole('status').filter({
      hasText: /This story (is no longer here|was deleted)/,
    });
    await expect(followup).toHaveCount(0);
  });

  test('export rename surfaces the new export as a sibling in the overlay', async ({ page }) => {
    const filePath = join(SCENARIOS_DIR, 'export-rename.stories.tsx');
    const title = 'rd/xr';
    const primaryId = buildStoryId(title, 'Primary');
    const renamedId = buildStoryId(title, 'Renamed');

    await writeStoryFile(filePath, { title, exports: ['Primary'] });
    await waitForStoryId(page, primaryId);

    await openStoryByUrl(page, primaryId);

    // Rename the only export. The classifier sees `Primary` removed and
    // `Renamed` added — a 1+1 add/remove is intentionally NOT paired, so
    // `Primary` becomes an orphan (origin recorded) and the overlay appears.
    await writeStoryFile(filePath, { title, exports: ['Renamed'] });
    await waitForStoryIdGone(page, primaryId);
    await waitForStoryId(page, renamedId);

    const overlay = page.getByRole('status').filter({
      hasText: 'This story is no longer here',
    });
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Sibling list should contain a link to the renamed story.
    const siblingLink = overlay.getByRole('link', { name: new RegExp(`Renamed`, 'i') });
    await expect(siblingLink).toBeVisible();

    // Clicking navigates via api.selectStory → URL updates to the new ID.
    await siblingLink.click();
    await page.waitForURL(
      (url) => url.search.includes(`path=/story/${renamedId}`),
      { timeout: 10_000 }
    );
  });

  test('file deletion shows the "was deleted" overlay', async ({ page }) => {
    const filePath = join(SCENARIOS_DIR, 'file-deletion.stories.tsx');
    const title = 'rd/fd';
    const primaryId = buildStoryId(title, 'Primary');

    await writeStoryFile(filePath, { title, exports: ['Primary'] });
    await waitForStoryId(page, primaryId);

    await openStoryByUrl(page, primaryId);

    await deleteStoryFile(filePath);
    await waitForStoryIdGone(page, primaryId);

    const overlay = page.getByRole('status').filter({
      hasText: 'This story was deleted',
    });
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // With the file gone there are no siblings to list, and there was no
    // autodocs entry attached to this scenario, so we should see neither a
    // sibling link nor a docs button inside the overlay.
    await expect(overlay.getByRole('link')).toHaveCount(0);
    await expect(overlay.getByRole('button', { name: /take me to .* docs/i })).toHaveCount(0);
  });

  test('export deletion keeps the remaining export available as a sibling', async ({ page }) => {
    const filePath = join(SCENARIOS_DIR, 'export-deletion.stories.tsx');
    const title = 'rd/xd';
    const primaryId = buildStoryId(title, 'Primary');
    const secondaryId = buildStoryId(title, 'Secondary');

    await writeStoryFile(filePath, { title, exports: ['Primary', 'Secondary'] });
    await waitForStoryId(page, primaryId);
    await waitForStoryId(page, secondaryId);

    await openStoryByUrl(page, primaryId);

    // Remove Primary, keep Secondary — Primary becomes an orphan with origin
    // set to the file's import path. Secondary stays in the index and should
    // render as the only sibling inside the overlay.
    await writeStoryFile(filePath, { title, exports: ['Secondary'] });
    await waitForStoryIdGone(page, primaryId);

    const overlay = page.getByRole('status').filter({
      hasText: 'This story is no longer here',
    });
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const siblingLink = overlay.getByRole('link', { name: /Secondary/i });
    await expect(siblingLink).toBeVisible();

    await siblingLink.click();
    await page.waitForURL(
      (url) => url.search.includes(`path=/story/${secondaryId}`),
      { timeout: 10_000 }
    );
  });
});
