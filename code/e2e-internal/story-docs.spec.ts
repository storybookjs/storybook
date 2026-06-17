import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');
const STATIC_LOAD_TIMEOUT = 20_000;

const codeDir = process.cwd();
const codePanelStoryPath = join(
  codeDir,
  'addons/docs/template/stories/codePanel/index.stories.tsx'
);

/** Story id for the Default export in the Code Panel demo (see internal Storybook index). */
const storyPath = '/story/addons-docs-codepanel--default';
const docsPath = '/docs/addons-docs-codepanel--docs';
const defaultStoryBlockId = 'story--addons-docs-codepanel--default';
const primaryStoryBlockId = `${defaultStoryBlockId}--primary`;
const componentId = 'addons-docs-codepanel';
const storyDocsStaticPath = `/services/core/story-docs/${componentId}.json`;

const E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE = 'e2eStoryDocsBefore';
const E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER = 'e2eStoryDocsAfter';

const defaultArgsLine = `  args: { label: '${E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE}' }`;
const hotUpdateArgsLine = `  args: { label: '${E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER}' }`;

// Start the internal dev server with STORYBOOK_EXPERIMENTAL_DOCGEN_SERVER=true before running the
// hot-update test. CI sets that env var in the internal Storybook e2e job. Static tests require a
// build produced with the same flag so story-docs snapshots exist under storybook-static/services/.
let originalCodePanelStorySource: string | undefined;

async function restoreFile(path: string, contents: string) {
  if ((await readFile(path, 'utf8')) !== contents) {
    await writeFile(path, contents, 'utf8');
  }
}

function previewFrame(page: Page) {
  return page.frameLocator('#storybook-preview-iframe');
}

async function expectExperimentalDocgenServer(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Boolean(
            (
              globalThis as {
                FEATURES?: { experimentalDocgenServer?: boolean };
              }
            ).FEATURES?.experimentalDocgenServer
          )
        ),
      { timeout: PREVIEW_STORY_TIMEOUT }
    )
    .toBe(true);
}

async function openCodePanel(page: Page) {
  await page.getByRole('tab', { name: 'Code' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Code' })).toBeVisible({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
}

async function expectCodePanelToContainLabel(
  page: Page,
  label: string,
  timeout = PREVIEW_STORY_TIMEOUT
) {
  await expect(page.getByRole('tabpanel', { name: 'Code' })).toContainText(label, { timeout });
}

function defaultStoryPreviewLocator(page: Page) {
  const frame = previewFrame(page);
  return frame
    .locator('.sbdocs-preview')
    .filter({
      has: frame.locator(`#${defaultStoryBlockId}, #${primaryStoryBlockId}`),
    })
    .first();
}

async function autodocsDefaultSourceLocator(page: Page) {
  const preview = defaultStoryPreviewLocator(page);
  await expect(preview).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });
  return preview.locator('pre.prismjs');
}

async function expectAutodocsDefaultSourceToContainLabel(
  page: Page,
  label: string,
  timeout = PREVIEW_STORY_TIMEOUT
) {
  await expect(await autodocsDefaultSourceLocator(page)).toContainText(label, { timeout });
}

async function expectAutodocsDefaultSourceNotToContainLabel(page: Page, label: string) {
  await expect(await autodocsDefaultSourceLocator(page)).not.toContainText(label);
}

async function expectPreviewButtonLabel(page: Page, label: string) {
  await expect(previewFrame(page).getByRole('button', { name: label })).toBeVisible({
    timeout: PREVIEW_STORY_TIMEOUT,
  });
}

async function gotoCodePanelStory(page: Page) {
  await page.goto(`${storybookUrl}/?path=${storyPath}`);
  await expectExperimentalDocgenServer(page);
  await waitForPreviewReady(page);
  await expect(
    previewFrame(page)
      .getByRole('button', { name: E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE })
      .or(previewFrame(page).getByRole('button', { name: E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER }))
  ).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });
}

async function gotoAutodocsPage(page: Page) {
  await page.goto(`${storybookUrl}/?path=${docsPath}`);
  await expectExperimentalDocgenServer(page);
  await waitForPreviewReady(page);
}

test.describe('story-docs open service', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test.describe('hot updates', () => {
    test.beforeAll(async () => {
      test.skip(
        !runsAgainstDevServer,
        'Story-docs hot updates require the dev server file watcher.'
      );

      originalCodePanelStorySource = await readFile(codePanelStoryPath, 'utf8');
    });

    test.afterAll(async () => {
      if (originalCodePanelStorySource) {
        await restoreFile(codePanelStoryPath, originalCodePanelStorySource);
      }
    });

    test('updates the Code panel and autodocs source when story args change without navigation', async ({
      page,
    }) => {
      await restoreFile(codePanelStoryPath, originalCodePanelStorySource!);
      expect(originalCodePanelStorySource).toContain(defaultArgsLine);

      await gotoAutodocsPage(page);
      await expectAutodocsDefaultSourceToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);

      await gotoCodePanelStory(page);
      await openCodePanel(page);
      await expectCodePanelToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);

      await gotoAutodocsPage(page);

      try {
        const current = await readFile(codePanelStoryPath, 'utf8');
        await writeFile(
          codePanelStoryPath,
          current.replace(defaultArgsLine, hotUpdateArgsLine),
          'utf8'
        );

        await expectAutodocsDefaultSourceToContainLabel(
          page,
          E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER
        );
        await expectAutodocsDefaultSourceNotToContainLabel(
          page,
          E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE
        );

        await gotoCodePanelStory(page);
        await openCodePanel(page);
        await expectPreviewButtonLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER);
        await expectCodePanelToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER);
        await expect(page.getByRole('tabpanel', { name: 'Code' })).not.toContainText(
          E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE
        );
      } finally {
        await restoreFile(codePanelStoryPath, originalCodePanelStorySource!);
      }
    });
  });

  test.describe('static build', () => {
    test('serves prebuilt story-docs JSON and renders snippets in the Code panel and autodocs', async ({
      page,
      request,
    }) => {
      test.skip(
        runsAgainstDevServer,
        'Prebuilt story-docs JSON requires a static Storybook build.'
      );

      const response = await request.get(`${storybookUrl}${storyDocsStaticPath}`);
      expect(response.ok()).toBe(true);

      const body = (await response.json()) as {
        components: Record<
          string,
          {
            id: string;
            stories: Record<string, { snippet?: string }>;
          }
        >;
      };

      const payload = body.components[componentId];
      expect(payload?.id).toBe(componentId);

      const defaultStory = Object.values(payload.stories).find((story) =>
        story.snippet?.includes(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE)
      );
      expect(defaultStory?.snippet).toContain(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);

      await gotoAutodocsPage(page);
      await expectAutodocsDefaultSourceToContainLabel(
        page,
        E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE,
        STATIC_LOAD_TIMEOUT
      );

      await gotoCodePanelStory(page);
      await openCodePanel(page);
      await expectCodePanelToContainLabel(
        page,
        E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE,
        STATIC_LOAD_TIMEOUT
      );
    });
  });
});
