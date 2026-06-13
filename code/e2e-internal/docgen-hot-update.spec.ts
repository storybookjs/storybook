import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import process from 'process';

import { PREVIEW_STORY_TIMEOUT, waitForPreviewReady } from './helpers.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const runsAgainstDevServer = !['build', 'static'].includes(process.env.STORYBOOK_TYPE || 'dev');

const codeDir = process.cwd();
const mainConfigPath = join(codeDir, '.storybook/main.ts');
const buttonSourcePath = join(codeDir, 'core/src/components/components/Button/Button.tsx');
const storyPath = '/story/button-component--base';
const hotUpdatePropName = 'e2eDocgenHotUpdateProp';
const hotUpdatePropSource = `
  /**
   * E2E-only docgen hot update marker.
   */
  ${hotUpdatePropName}?: 'before' | 'after';
`;

let originalMainConfig: string | undefined;
let originalButtonSource: string | undefined;

async function restoreFile(path: string, contents: string) {
  if ((await readFile(path, 'utf8')) !== contents) {
    await writeFile(path, contents, 'utf8');
  }
}

async function enableExperimentalDocgenServer() {
  const current = await readFile(mainConfigPath, 'utf8');
  originalMainConfig = current;

  if (!current.includes('experimentalDocgenServer: false')) {
    return;
  }

  await writeFile(
    mainConfigPath,
    current.replace('experimentalDocgenServer: false', 'experimentalDocgenServer: true')
  );
}

async function addHotUpdateProp() {
  const current = await readFile(buttonSourcePath, 'utf8');
  if (current.includes(hotUpdatePropName)) {
    return;
  }

  const marker = '  shortcut?: API_KeyCollection;\n';
  expect(current, `Could not find ButtonProps insertion marker in ${buttonSourcePath}`).toContain(
    marker
  );

  await writeFile(buttonSourcePath, current.replace(marker, `${marker}${hotUpdatePropSource}`));
}

async function waitForStorybookServer() {
  await expect
    .poll(
      async () => {
        try {
          const response = await fetch(storybookUrl);
          return response.ok;
        } catch {
          return false;
        }
      },
      { timeout: PREVIEW_STORY_TIMEOUT }
    )
    .toBe(true);
}

test.describe('docgen open service hot updates', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    test.skip(!runsAgainstDevServer, 'Docgen hot updates require the dev server file watcher.');

    originalButtonSource = await readFile(buttonSourcePath, 'utf8');
    await enableExperimentalDocgenServer();
    await waitForStorybookServer();
  });

  test.afterAll(async () => {
    await Promise.all([
      originalButtonSource ? restoreFile(buttonSourcePath, originalButtonSource) : undefined,
      originalMainConfig ? restoreFile(mainConfigPath, originalMainConfig) : undefined,
    ]);
  });

  test('updates manager Controls when a component prop type changes without navigation', async ({
    page,
  }) => {
    await restoreFile(buttonSourcePath, originalButtonSource!);

    await page.goto(`${storybookUrl}/?path=${storyPath}`);
    await waitForPreviewReady(page);
    await expect(
      page.frameLocator('#storybook-preview-iframe').getByRole('button', { name: 'Button' })
    ).toBeVisible({ timeout: PREVIEW_STORY_TIMEOUT });

    await page.getByRole('tab', { name: 'Controls' }).click();
    const controlsPanel = page.getByRole('tabpanel', { name: 'Controls' });
    await expect(
      controlsPanel.getByRole('cell', { name: 'ariaLabel', exact: true }).first()
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
