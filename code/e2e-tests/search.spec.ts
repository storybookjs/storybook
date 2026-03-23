import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('searching', () => {
  test('a non-docs story renders the label a11y friendly', async ({ page }) => {
    await page.goto(`${storybookUrl}`);
    await page.getByRole('searchbox').fill('Primary');
    await expect(
      page.getByRole('option', {
        name: 'Example, Button, Primary',
        exact: true,
      })
    ).toBeVisible();
  });

  test('a docs story renders the label a11y friendly', async ({ page }) => {
    await page.goto(`${storybookUrl}`);
    await page.getByRole('searchbox').fill('Docs');
    await expect(
      page.getByRole('option', {
        name: 'Docs, Configure your project',
        exact: true,
      })
    ).toBeVisible();
  });
});
