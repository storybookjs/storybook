import { expect, test } from '@playwright/test';
import process from 'process';

import { SbPage, isReactSandbox } from './util.ts';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('addon-controls', () => {
  test('should change component when changing controls', async ({ page }) => {
    test.skip(templateName.includes('react-native-web'), 'React Native CSS behaves differently');

    await page.goto(storybookUrl);
    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();

    await sbPage.navigateToStory('example/button', 'primary');
    await sbPage.viewAddonPanel('Controls');

    // Text input: Label
    await expect(sbPage.previewRoot().locator('button')).toContainText('Button');
    const label = sbPage.panelContent().locator('textarea[name=label]');
    await label.fill('Hello world');
    await expect(sbPage.previewRoot().locator('button')).toContainText('Hello world');

    // Args in URL
    await page.waitForURL((url) => url.search.includes('args=label:Hello+world'));

    // Boolean toggle: Primary/secondary
    await expect(sbPage.previewRoot().locator('button')).toHaveCSS(
      'background-color',
      'rgb(85, 90, 185)'
    );
    const toggle = sbPage.panelContent().locator('label:has(input[name="primary"])');
    await toggle.click();
    await expect(async () => {
      await expect(sbPage.previewRoot().locator('button')).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)'
      );
    }).toPass();

    // Color picker: Background color
    const color = sbPage.panelContent().locator('input[placeholder="Choose color..."]');
    await color.fill('red');
    await expect(async () => {
      await expect(sbPage.previewRoot().locator('button')).toHaveCSS(
        'background-color',
        'rgb(255, 0, 0)'
      );
    }).toPass();

    // TODO: enable this once the controls for size are aligned in all CLI templates.
    // Radio buttons: Size
    // cy.getStoryElement().find('button').should('have.css', 'font-size', '14px');
    // cy.get('label[for="size-large"]').click();
    // cy.getStoryElement().find('button').should('have.css', 'font-size', '16px');

    // Reset controls: assert that the component is back to original state
    const reset = sbPage.panelContent().locator('[aria-label="Reset controls"]');
    await reset.click();
    const button = sbPage.previewRoot().locator('button');
    await expect(button).toHaveCSS('font-size', '14px');
    await expect(button).toHaveCSS('background-color', 'rgb(85, 90, 185)');
    await expect(button).toContainText('Button');
  });

  test('should apply controls automatically when passed via url', async ({ page }) => {
    await page.goto(`${storybookUrl}?path=/story/example-button--primary&args=label:Hello+world`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await expect(sbPage.previewRoot().locator('button')).toContainText('Hello world');

    await sbPage.viewAddonPanel('Controls');
    const label = sbPage.panelContent().locator('textarea[name=label]');
    await expect(label).toHaveValue('Hello world');
  });

  test('should set select option when value contains double spaces', async ({ page }) => {
    await page.goto(`${storybookUrl}?path=/story/core-controls-basics--undefined`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.closeAnyPendingModal();

    await sbPage.viewAddonPanel('Controls');
    await sbPage.panelContent().locator('#control-select').selectOption('double  space');

    await expect(sbPage.panelContent().locator('#control-select')).toHaveValue('double  space');
    await expect(page).toHaveURL(/.*select:double\+\+space.*/);
  });

  test('should set multiselect option when value contains double spaces', async ({ page }) => {
    await page.goto(`${storybookUrl}?path=/story/core-controls-basics--undefined`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.closeAnyPendingModal();
    await sbPage.viewAddonPanel('Controls');
    await sbPage.panelContent().locator('#control-multiSelect').selectOption('double  space');

    await expect(sbPage.panelContent().locator('#control-multiSelect')).toHaveValue(
      'double  space'
    );

    await expect(page).toHaveURL(/.*multiSelect\[0]:double\+\+space.*/);
  });

  // We want to avoid the controls panel crashing when JSX elements are part of args table
  test('should show JSX elements in controls panel', async ({ page }) => {
    test.skip(!isReactSandbox(templateName), 'This is a React only feature');
    await page.goto(`${storybookUrl}?path=/story/stories-renderers-react-jsx-docgen--default`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.viewAddonPanel('Controls');
    await expect(sbPage.panelContent().getByText('children').first()).toBeVisible();
  });

  test('should render boolean control with explicit forced-colors styling', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(`${storybookUrl}?path=/story/example-button--primary`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.viewAddonPanel('Controls');

    const panel = sbPage.panelContent();
    const label = panel.locator('label:has(input[name="primary"])');
    const input = panel.locator('input[name="primary"]');
    const falseOption = label.locator('span').first();
    const trueOption = label.locator('span').last();
    const outlineColorBeforeFocus = await label.evaluate((el) => getComputedStyle(el).outlineColor);

    expect(await label.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await input.focus();
    await expect(input).toBeFocused();

    const outlineColorAfterFocus = await label.evaluate((el) => getComputedStyle(el).outlineColor);

    await expect(label).toHaveCSS('outline-style', 'solid');
    await expect(label).toHaveCSS('outline-width', '1px');
    await expect(trueOption).toHaveCSS('forced-color-adjust', 'none');
    await expect(falseOption).toHaveCSS('box-shadow', 'none');
    await expect(trueOption).toHaveCSS('box-shadow', 'none');
    expect(outlineColorAfterFocus).not.toBe(outlineColorBeforeFocus);

    const selectedBackground = await trueOption.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const unselectedBackground = await falseOption.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );

    expect(selectedBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(selectedBackground).not.toBe(unselectedBackground);
  });

  test('should not add hover shadow to the inactive boolean option', async ({ page }) => {
    await page.goto(`${storybookUrl}?path=/story/example-button--primary`);

    const sbPage = new SbPage(page, expect);
    await sbPage.waitUntilLoaded();
    await sbPage.viewAddonPanel('Controls');

    const falseOption = sbPage
      .panelContent()
      .locator('label:has(input[name="primary"]) span')
      .first();
    await falseOption.hover();

    await expect(falseOption).toHaveCSS('box-shadow', 'none');
  });
});
