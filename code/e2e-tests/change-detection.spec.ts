import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SbPage } from './util.ts';

/**
 * Change Detection E2E tests.
 *
 * Prerequisites:
 *   1. STORYBOOK_URL — URL of a running Storybook dev server
 *   2. STORYBOOK_SANDBOX_DIR — path to the sandbox root
 *      (e.g. ../storybook-sandboxes/react-vite-default-ts)
 *   3. The sandbox's .storybook/main.ts must have: features: { changeDetection: true }
 *   4. STORYBOOK_TEMPLATE_NAME must be one of the supported templates (or be unset for local runs)
 *   5. The sandbox must already have a git repo with an initial commit — this is handled
 *      automatically by the sandbox generation task (scripts/tasks/sandbox.ts).
 *
 * Supported templates: react-vite/default-ts, nextjs-vite/default-ts,
 *                      react-webpack/default-ts, nextjs/default-ts
 */

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const sandboxDir = process.env.STORYBOOK_SANDBOX_DIR || '';
const type = process.env.STORYBOOK_TYPE || 'dev';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

const CHANGE_DETECTION_TIMEOUT = 15_000;

// Resolve paths eagerly so test.skip() calls need no if-conditionals inside tests.
const buttonStoriesPath =
  sandboxDir &&
  ([
    path.join(sandboxDir, 'src/stories/Button.stories.ts'),
    path.join(sandboxDir, 'src/stories/Button.stories.tsx'),
  ].find((p) => fs.existsSync(p)) ??
    null);

const buttonComponentPath =
  sandboxDir &&
  ([path.join(sandboxDir, 'src/stories/Button.tsx'), path.join(sandboxDir, 'src/Button.tsx')].find(
    (p) => fs.existsSync(p)
  ) ??
    null);

test.describe('Change Detection', () => {
  test.skip(!sandboxDir, 'Set STORYBOOK_SANDBOX_DIR to run change detection tests');
  test.skip(type !== 'dev', 'Change detection only runs in dev mode');
  const SUPPORTED_TEMPLATES = [
    'react-vite/default-ts',
    'nextjs-vite/default-ts',
    'react-webpack/default-ts',
    'nextjs/default-ts',
  ];
  test.skip(
    !!templateName && !SUPPORTED_TEMPLATES.includes(templateName),
    `Change detection E2E tests only run for: ${SUPPORTED_TEMPLATES.join(', ')}`
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(`${storybookUrl}/?path=/story/example-button--primary`);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('shows "new" status for an untracked story file', async ({ page }) => {
    const newStoryPath = path.join(sandboxDir, 'src/stories/ChangeDetectionNew.stories.tsx');

    console.log({ newStoryPath });

    try {
      fs.writeFileSync(
        newStoryPath,
        [
          "import type { Meta, StoryObj } from '@storybook/react';",
          '',
          "const meta = { title: 'Example/ChangeDetectionNew' } satisfies Meta;",
          'export default meta;',
          '',
          'export const Default: StoryObj<typeof meta> = {};',
        ].join('\n')
      );

      // New stories roll up to "Change status: New" on the parent component node
      await expect(page.locator('[aria-label="Change status: New"]').first()).toBeVisible({
        timeout: CHANGE_DETECTION_TIMEOUT,
      });
    } finally {
      fs.rmSync(newStoryPath, { force: true });
    }
  });

  test('shows "modified" status for a changed story file', async ({ page }) => {
    test.skip(!buttonStoriesPath, 'Button.stories file not found in STORYBOOK_SANDBOX_DIR');

    const storyPath = buttonStoriesPath as string;
    const original = fs.readFileSync(storyPath, 'utf-8');

    try {
      fs.writeFileSync(storyPath, `${original}\n// change-detection-e2e-modified`);

      await expect(
        page.locator('[data-item-id="example-button"] [aria-label="Change status: Modified"]')
      ).toBeVisible({ timeout: CHANGE_DETECTION_TIMEOUT });
    } finally {
      fs.writeFileSync(storyPath, original);
    }
  });

  test('shows "related" status for stories whose dependency changed', async ({ page }) => {
    test.skip(!buttonComponentPath, 'Button.tsx not found in STORYBOOK_SANDBOX_DIR');

    const componentPath = buttonComponentPath as string;
    const original = fs.readFileSync(componentPath, 'utf-8');

    try {
      fs.writeFileSync(componentPath, `${original}\n// change-detection-e2e-affected`);

      // Header.stories is depth-2 from Button.tsx (via Header.tsx); depth-1 Button.stories gets "Modified"
      await expect(
        page.locator('[data-item-id="example-header"] [aria-label="Change status: Affected"]')
      ).toBeVisible({ timeout: CHANGE_DETECTION_TIMEOUT });
    } finally {
      fs.writeFileSync(componentPath, original);
    }
  });
});
