/* eslint-disable jest/no-disabled-tests */
import { test, expect } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('JSON files', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
  });

  test('should have index.json', async ({ page }) => {
    test.skip(
      // eslint-disable-next-line jest/valid-title
      templateName.includes('ssv6'),
      'Only run this test for Sandboxes with StoryStoreV7 enabled'
    );
    const json = await page.evaluate(() => fetch('/index.json').then((res) => res.json()));

    expect(json).toEqual({
      v: expect.any(Number),
      entries: expect.objectContaining({
        'example-button--primary': expect.objectContaining({
          id: 'example-button--primary',
          importPath: expect.stringMatching(/button\.stories/i),
          name: 'Primary',
          title: 'Example/Button',
          type: 'story',
        }),
      }),
    });
  });
});
