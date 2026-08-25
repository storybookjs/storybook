import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const sandboxDir = process.env.STORYBOOK_SANDBOX_DIR || '';
const type = process.env.STORYBOOK_TYPE || 'dev';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

/** Only this template runs the docgen open service (experimentalDocgenServer) for Angular. */
const SUPPORTED_TEMPLATES = ['angular-vite/docgen-server-ts'];

const PREVIEW_STORY_TIMEOUT = 30_000;

const buttonSourcePath = sandboxDir && join(sandboxDir, 'src/stories/button.component.ts');
const storyPath = '/story/example-button--primary';
const hotUpdatePropName = 'e2eDocgenHotUpdateProp';
const hotUpdatePropSource = `
  /** E2E-only docgen hot update marker. */
  @Input()
  ${hotUpdatePropName}?: 'before' | 'after';
`;

let originalButtonSource: string | undefined;

async function restoreFile(path: string, contents: string) {
  if ((await readFile(path, 'utf8')) !== contents) {
    await writeFile(path, contents, 'utf8');
  }
}

async function addHotUpdateProp() {
  const current = await readFile(buttonSourcePath, 'utf8');
  if (current.includes(hotUpdatePropName)) {
    return;
  }

  const marker = '  /** Optional click handler */\n';
  expect(
    current,
    `Could not find ButtonComponent insertion marker in ${buttonSourcePath}`
  ).toContain(marker);

  await writeFile(buttonSourcePath, current.replace(marker, `${hotUpdatePropSource}${marker}`));
}

test.describe('docgen open service hot updates (Angular)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);
  test.skip(!sandboxDir, 'Set STORYBOOK_SANDBOX_DIR to run docgen hot update tests');
  test.skip(type !== 'dev', 'Docgen hot updates require the dev server file watcher.');
  test.skip(
    !!templateName && !SUPPORTED_TEMPLATES.includes(templateName),
    `Docgen hot update E2E tests only run for: ${SUPPORTED_TEMPLATES.join(', ')}`
  );

  test.beforeAll(async () => {
    originalButtonSource = await readFile(buttonSourcePath, 'utf8');
  });

  test.afterAll(async () => {
    if (originalButtonSource) {
      await restoreFile(buttonSourcePath, originalButtonSource);
    }
  });

  test('updates manager Controls when a component input type changes without navigation', async ({
    page,
  }) => {
    await restoreFile(buttonSourcePath, originalButtonSource!);

    await page.goto(`${storybookUrl}/?path=${storyPath}`);
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
    await expect(page.getByRole('progressbar', { name: 'Content is loading...' })).toBeHidden({
      timeout: PREVIEW_STORY_TIMEOUT,
    });
    await expect(
      page.frameLocator('#storybook-preview-iframe').getByRole('button', { name: 'Button' })
    ).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });

    await page.getByRole('tab', { name: 'Controls' }).click();
    const controlsPanel = page.getByRole('tabpanel', { name: 'Controls' });
    await expect(
      controlsPanel.getByRole('cell', { name: 'primary', exact: true }).first()
    ).toBeVisible({
      timeout: PREVIEW_STORY_TIMEOUT,
    });
    await expect(controlsPanel.getByText(hotUpdatePropName)).toHaveCount(0);

    try {
      await addHotUpdateProp();

      await expect(
        controlsPanel.getByRole('cell', { name: hotUpdatePropName, exact: true }).first()
      ).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });
    } finally {
      await restoreFile(buttonSourcePath, originalButtonSource!);
    }
  });
});
