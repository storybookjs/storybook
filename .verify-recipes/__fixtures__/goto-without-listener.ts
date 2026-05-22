// Fixture: should fail ESLint with verify-recipes/listener-before-goto
// This spec calls page.goto() without registering a listener first.
import { test, expect } from './_util.ts';

test('navigate without listener', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
});
