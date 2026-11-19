import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, dropPreviewSnippets, waitForPreviewReady } from './helpers.ts';

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
const liveSourceDocsPath = '/docs/addons-docs-codepanel--live-source';
const defaultStoryBlockId = 'story--addons-docs-codepanel--default';
const primaryStoryBlockId = `${defaultStoryBlockId}--primary`;
const componentId = 'addons-docs-codepanel';
const storyDocsStaticPath = `/services/core/story-docs/${componentId}.json`;

const E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE = 'e2eStoryDocsBefore';
const E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER = 'e2eStoryDocsAfter';

const defaultArgsLine = `  args: { label: '${E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE}' }`;
const hotUpdateArgsLine = `  args: { label: '${E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER}' }`;

let originalCodePanelStorySource: string | undefined;

async function restoreFile(path: string, contents: string) {
  if ((await readFile(path, 'utf8')) !== contents) {
    await writeFile(path, contents, 'utf8');
  }
}

function previewFrame(page: Page) {
  return page.frameLocator('#storybook-preview-iframe');
}

async function expectDocgenServer(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Boolean(
            (
              globalThis as {
                FEATURES?: { docgenServer?: boolean };
              }
            ).FEATURES?.docgenServer
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
  await expectDocgenServer(page);
  await waitForPreviewReady(page);
  await expect(
    previewFrame(page)
      .getByRole('button', { name: E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE })
      .or(previewFrame(page).getByRole('button', { name: E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER }))
  ).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });
}

async function gotoStory(page: Page, path: string) {
  await page.goto(`${storybookUrl}/?path=${path}`);
  await expectDocgenServer(page);
  await waitForPreviewReady(page);
}

async function gotoAutodocsPage(page: Page) {
  await page.goto(`${storybookUrl}/?path=${docsPath}`);
  await expectDocgenServer(page);
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

    test.afterEach(async () => {
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

      const current = await readFile(codePanelStoryPath, 'utf8');
      await writeFile(
        codePanelStoryPath,
        current.replace(defaultArgsLine, hotUpdateArgsLine),
        'utf8'
      );

      await expectAutodocsDefaultSourceToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_AFTER);
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
    });
  });

  // Runs against the dev server and the static build: once the args change, the preview fills the
  // snippet template with them.
  test.describe('live snippets', () => {
    const LIVE_LABEL = 'e2eLiveSnippet';

    test('the Code panel follows the controls', async ({ page }) => {
      await gotoCodePanelStory(page);
      await openCodePanel(page);
      await expectCodePanelToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);
      // The templates come with the story docs, so changing the args loads nothing again.
      const storyDocsRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/services/core/story-docs/')) {
          storyDocsRequests.push(new URL(request.url()).pathname);
        }
      });

      await page.getByRole('tab', { name: 'Controls' }).click();
      const label = page.locator('#storybook-panel-root textarea[name=label]');
      await label.fill(`${LIVE_LABEL}First`);
      await expectPreviewButtonLabel(page, `${LIVE_LABEL}First`);
      await label.fill(LIVE_LABEL);
      await expectPreviewButtonLabel(page, LIVE_LABEL);

      await openCodePanel(page);
      await expectCodePanelToContainLabel(page, LIVE_LABEL);
      await expect(page.getByRole('tabpanel', { name: 'Code' })).not.toContainText(
        E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE
      );
      expect(storyDocsRequests).toStrictEqual([]);
    });

    test('autodocs Show code follows the controls', async ({ page }) => {
      await gotoAutodocsPage(page);
      await expectAutodocsDefaultSourceToContainLabel(page, E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);

      await previewFrame(page).locator('textarea[name=label]').fill(LIVE_LABEL);
      const source = await autodocsDefaultSourceLocator(page);
      await expect(source).toContainText(LIVE_LABEL);
      await expect(source).not.toContainText(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);
    });

    test('the Code panel follows the controls without the snippet the preview sends', async ({
      page,
    }) => {
      await dropPreviewSnippets(page);
      await gotoCodePanelStory(page);

      await page.getByRole('tab', { name: 'Controls' }).click();
      await page.locator('#storybook-panel-root textarea[name=label]').fill(LIVE_LABEL);
      await expectPreviewButtonLabel(page, LIVE_LABEL);

      await openCodePanel(page);
      await expect(page.getByRole('tabpanel', { name: 'Code' })).toContainText(LIVE_LABEL, {
        timeout: PREVIEW_STORY_TIMEOUT,
      });
    });

    // The manager cannot run a `transform`, so the Code panel shows the preview's snippet.
    test('the Code panel shows the snippet a story transforms', async ({ page }) => {
      await gotoStory(page, '/story/addons-docs-examples-stories-for-the-source-block--transform');
      await page.getByRole('tab', { name: 'Controls' }).click();
      await page.locator('#storybook-panel-root textarea[name=something]').fill(LIVE_LABEL);

      await openCodePanel(page);
      const panel = page.getByRole('tabpanel', { name: 'Code' });
      await expect(panel).toContainText(LIVE_LABEL, { timeout: PREVIEW_STORY_TIMEOUT });
      await expect(panel).toContainText(
        'this comment has been added via parameters.docs.source.transform!'
      );
    });

    test.describe('args no snippet can show', () => {
      const storyPath = '/story/addons-docs-examples-live-snippet-args--primary';
      const staticSnippet = 'tags={new Set(["apple", "pear"])}';
      const warningFor = (arg: string) =>
        `The snippet cannot show the current value of the \`${arg}\` arg.`;

      for (const [button, arg] of [
        ['Add a tag', 'tags'],
        ['Change onSelect', 'onSelect'],
      ]) {
        test(`the Code panel warns about ${arg} and keeps the static snippet`, async ({ page }) => {
          await gotoStory(page, storyPath);
          await openCodePanel(page);
          const panel = page.getByRole('tabpanel', { name: 'Code' });
          await expect(panel).toContainText(staticSnippet, { timeout: PREVIEW_STORY_TIMEOUT });
          const warning = panel.getByRole('button', { name: 'Incomplete code snippet' });
          await expect(warning).toHaveCount(0);

          await previewFrame(page).getByRole('button', { name: button }).click();

          await warning.hover();
          await expect(page.getByText(warningFor(arg))).toBeVisible();
          await expect(panel).toContainText(staticSnippet);
        });
      }

      test('autodocs warns about a Set and keeps the static snippet', async ({ page }) => {
        await gotoStory(page, '/docs/addons-docs-examples-live-snippet-args--docs');
        // The primary story comes first on the page.
        const docs = previewFrame(page);
        await docs.getByRole('switch', { name: 'Show code' }).first().click();
        const source = docs.locator('pre.prismjs').first();
        await expect(source).toContainText(staticSnippet, { timeout: PREVIEW_STORY_TIMEOUT });

        await docs.getByRole('button', { name: 'Add a tag' }).first().click();

        await docs.getByRole('button', { name: 'Incomplete code snippet' }).first().hover();
        await expect(docs.getByText(warningFor('tags'))).toBeVisible();
        await expect(source).toContainText(staticSnippet);
      });
    });

    test('an MDX Source block follows the controls', async ({ page }) => {
      await page.goto(`${storybookUrl}/?path=${liveSourceDocsPath}`);
      await expectDocgenServer(page);
      await waitForPreviewReady(page);
      const source = previewFrame(page).locator('pre.prismjs');
      await expect(source).toContainText(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE, {
        timeout: PREVIEW_STORY_TIMEOUT,
      });

      await previewFrame(page).locator('textarea[name=label]').fill(LIVE_LABEL);
      await expect(source).toContainText(LIVE_LABEL);
      await expect(source).not.toContainText(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);
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
            stories: Record<string, { snippet?: string; template?: unknown[] }>;
          }
        >;
      };

      const payload = body.components[componentId];
      expect(payload?.id).toBe(componentId);

      const defaultStory = Object.values(payload.stories).find((story) =>
        story.snippet?.includes(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE)
      );
      expect(defaultStory?.snippet).toContain(E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE);
      expect(defaultStory?.template).toContainEqual({
        kind: 'attr',
        arg: 'label',
        text: ` label="${E2E_STORY_DOCS_HOT_UPDATE_LABEL_BEFORE}"`,
        space: ' ',
      });

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
