import { expect, test } from '@playwright/test';
import process from 'process';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('searching', () => {
  test('a non-docs story renders the label a11y friendly', async ({ page }) => {
    await page.goto(`${storybookUrl}`);
    await page.getByRole('searchbox').fill('Primary');
    const option = page.getByRole('option', {
      name: 'Example, Button, Primary',
      exact: true,
    });

    await expect(option).toBeVisible();
    await expect(option.locator('[aria-hidden="true"]')).toBeVisible();
  });

  test('a docs story renders the label a11y friendly', async ({ page }) => {
    await page.goto(`${storybookUrl}`);
    await page.getByRole('searchbox').fill('Docs');
    const option = page.getByRole('option', {
      name: 'Docs, Configure your project',
      exact: true,
    });

    await expect(option).toBeVisible();
    await expect(option.locator('[aria-hidden="true"]')).toBeVisible();
  });
});
