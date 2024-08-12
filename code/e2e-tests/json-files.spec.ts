import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('JSON files', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
  });

  test('should have index.json', async ({ page }) => {
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
