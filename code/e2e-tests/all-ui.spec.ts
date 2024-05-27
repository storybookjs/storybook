import { test, expect } from '@playwright/test';
import process from 'process';
import dedent from 'ts-dedent';
import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';

test.describe('All UI Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);

    await new SbPage(page).waitUntilLoaded();
  });

  test('check presence of All UI elements', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Check the All UI page URL
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Wait for the dom content to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that the main container is visible
    await expect(root.locator('.sb-container')).toBeVisible({ timeout: 10000 });

    // Check the presence of the section title
    await expect(root.locator('.sb-section-title')).toHaveText(
      'Showcase all UI elements available in the Storybook UI. This is a great way to get familiar with the UI and see how different components are rendered.'
    );

    // Check that the button container is visible
    await expect(root.locator('.button')).toBeVisible();

    // Check for a specific UI element, 'Example/Button' story
    await expect(root.getByRole('heading', { name: 'Button' })).toBeVisible();
    await expect(root.locator('a[href*="example-button--docs"]')).toBeVisible();

    // Check for a specific UI element, 'Example/Header' story
    await expect(root.getByRole('heading', { name: 'Header' })).toBeVisible();
    await expect(root.locator('a[href*="example-header--docs"]')).toBeVisible();

    // Check for a specific UI element, 'Example/Page' story
    await expect(root.getByRole('heading', { name: 'Page' })).toBeVisible();
    await expect(root.locator('a[href*="example-page--docs"]')).toBeVisible();

    // Check for the visibility of the Button
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).not.toBeVisible();

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();

    // Check for the visibility of the Page
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();
  });

  test('check expand/collapse stories toggle', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Check the All UI page URL
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Wait for the dom content to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that the main container is visible
    await expect(root.locator('.sb-container')).toBeVisible({ timeout: 10000 });

    // Check the presence of the section title
    await expect(root.locator('.sidebar-subheading-action')).toBeVisible();

    // Check for the visibility of the Button
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).not.toBeVisible();

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).first()).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).first()).not.toBeVisible();

    // Check for the visibility of the Page
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).nth(1)).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).nth(1)).not.toBeVisible();

    // Expand all the stories
    await root.locator('.sidebar-subheading-action').click();

    // Check for the visibility of the Button
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).toBeVisible();

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).first()).toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).first()).toBeVisible();

    // Check for the visibility of the Page
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).nth(1)).toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).nth(1)).toBeVisible();

    // Collapse all the stories
    await root.locator('.sidebar-subheading-action').click();

    // Check for the visibility of the Button
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).not.toBeVisible();

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).first()).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).first()).not.toBeVisible();

    // Check for the visibility of the Page
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' }).nth(1)).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' }).nth(1)).not.toBeVisible();
  });

  test('should navigate to the button documentation page', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Navigate to the All UI page
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Click on the link to navigate to the Button documentation
    await root.locator('a[href*="example-button--docs"]').click();
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/story/example-button--docs`);

    // Check the presence of the Button title and description
    await expect(root.getByRole('heading', { name: 'Button' })).toBeVisible();
    await expect(
      root.locator('p', { hasText: 'Primary UI component for user interaction' })
    ).toBeVisible();

    // Check the presence of the Button Canvas
    await expect((await root.locator('#anchor--example-button--primary').all())[0]).toBeVisible();

    // Check the presence of the Button Controls
    await expect(root.locator('.css-14m39zm')).toBeVisible();

    await expect(root.locator('h2', { hasText: 'Stories' })).toBeVisible();

    // Check the presence of the Primary title and Canvas
    await expect(root.locator('h3', { hasText: 'Primary' })).toBeVisible();
    await expect((await root.locator('#anchor--example-button--primary').all())[1]).toBeVisible();

    // Check the presence of the Secondary title and Canvas
    await expect(root.locator('h3', { hasText: 'Secondary' })).toBeVisible();
    await expect(root.locator('#anchor--example-button--secondary')).toBeVisible();

    // Check the presence of the Large title and Canvas
    await expect(root.locator('h3', { hasText: 'Large' })).toBeVisible();
    await expect(root.locator('#anchor--example-button--large')).toBeVisible();

    // Check the presence of the Small title and Canvas
    await expect(root.locator('h3', { hasText: 'Small' })).toBeVisible();
    await expect(root.locator('#anchor--example-button--small')).toBeVisible();
  });

  test('check expand button stories', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Check the All UI page URL
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Wait for the dom content to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that the button container is visible
    await expect(root.locator('.button')).toBeVisible();

    // Check for the visibility of the Button
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).not.toBeVisible();

    // Expand the 'Button' story and check its elements
    await root.locator('h3', { hasText: 'Primary' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode = root.locator('pre.prismjs');
    const expectedSource = dedent`
      <Button
        label="Button"
        onClick={() => {}}
        primary
      />
    `;
    const normalizeCode = (code: string) =>
      code.replace(/onClick=\{function.*\(\)\{\}\}/, 'onClick={() => {}}');
    const actualSourceCode = await sourceCode.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode)).toBe(normalizeCode(expectedSource));

    // Close the 'Button' story
    await root.locator('h3', { hasText: 'Primary' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Primary' })).not.toBeVisible();

    // Expand the 'Button' story and check its elements
    await root.locator('h3', { hasText: 'Secondary' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode2 = root.locator('pre.prismjs');
    const expectedSource2 = dedent`
      <Button
        label="Button"
        onClick={() => {}}
      />
    `;
    const actualSourceCode2 = await sourceCode2.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode2)).toBe(normalizeCode(expectedSource2));

    // Close the 'Button' story
    await root.locator('h3', { hasText: 'Secondary' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Secondary' })).not.toBeVisible();

    // Expand the 'Button' story and check its elements
    await root.locator('h3', { hasText: 'Large' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode3 = root.locator('pre.prismjs');
    const expectedSource3 = dedent`
      <Button
        label="Button"
        onClick={() => {}}
        size="large"
      />
    `;
    const actualSourceCode3 = await sourceCode3.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode3)).toBe(normalizeCode(expectedSource3));

    // Close the 'Button' story
    await root.locator('h3', { hasText: 'Large' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Large' })).not.toBeVisible();

    // Expand the 'Button' story and check its elements
    await root.locator('h3', { hasText: 'Small' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode4 = root.locator('pre.prismjs');
    const expectedSource4 = dedent`
      <Button
        label="Button"
        onClick={() => {}}
        size="small"
      />
    `;
    const actualSourceCode4 = await sourceCode4.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode4)).toBe(normalizeCode(expectedSource4));

    // Close the 'Button' story
    await root.locator('h3', { hasText: 'Small' }).click();
    await expect(root.locator('h3.expanded', { hasText: 'Small' })).not.toBeVisible();
  });

  test('should navigate to the header documentation page', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Navigate to the All UI page
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Click on the link to navigate to the Button documentation
    await root.locator('a[href*="example-header--docs"]').click();
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/story/example-header--docs`);

    // Check the presence of the Header title
    await expect(root.getByRole('heading', { name: 'Header' })).toBeVisible();

    // Check the presence of the Header Canvas
    await expect((await root.locator('#anchor--example-header--logged-in').all())[0]).toBeVisible();

    // Check the presence of the Header Controls
    await expect(root.locator('.css-14m39zm')).toBeVisible();
    await expect(root.locator('h2', { hasText: 'Stories' })).toBeVisible();

    // Check the presence of the LoggedIn title and Canvas
    await expect(root.locator('h3', { hasText: 'Logged In' })).toBeVisible();
    await expect((await root.locator('#anchor--example-header--logged-in').all())[1]).toBeVisible();

    // Check the presence of the LoggedOut title and Canvas
    await expect(root.locator('h3', { hasText: 'Logged Out' })).toBeVisible();
    await expect(root.locator('#anchor--example-header--logged-out')).toBeVisible();
  });

  test('check expand header stories', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Check the All UI page URL
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Wait for the dom content to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that the header container is visible
    await expect(root.locator('.header')).toBeVisible();

    const loggedIn = (await root.locator('h3', { hasText: 'LoggedIn' }).all())[0];

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();

    // Expand the 'LoggedIn' story and check its elements
    await loggedIn.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode = root.locator('pre.prismjs');
    const expectedSource = dedent`
      <Header
        onCreateAccount={() => {}}
        onLogin={() => {}}
        onLogout={() => {}}
        user={{
          name: 'Jane Doe'
        }}
      />
    `;

    const normalizeCode = (code: string) => {
      return code
        .replace(/onCreateAccount=\{function.*\(\)\{\}\}/, 'onCreateAccount={() => {}}')
        .replace(/onLogin=\{function.*\(\)\{\}\}/, 'onLogin={() => {}}')
        .replace(/onLogout=\{function.*\(\)\{\}\}/, 'onLogout={() => {}}');
    };
    const actualSourceCode = await sourceCode.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode)).toBe(normalizeCode(expectedSource));

    // Close the 'LoggedIn' story
    await loggedIn.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();

    const loggedOut = (await root.locator('h3', { hasText: 'LoggedOut' }).all())[0];

    // Expand the 'LoggedOut' story and check its elements
    await loggedOut.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode2 = root.locator('pre.prismjs');
    const expectedSource2 = dedent`
      <Header
        onCreateAccount={() => {}}
        onLogin={() => {}}
        onLogout={() => {}}
      />
    `;
    const actualSourceCode2 = await sourceCode2.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(normalizeCode(actualSourceCode2)).toBe(normalizeCode(expectedSource2));

    // Close the 'LoggedOut' story
    await loggedOut.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();
  });

  test('check expand page stories', async ({ page }) => {
    const sbPage = new SbPage(page);
    const root = sbPage.previewRoot();

    // Check the All UI page URL
    await expect(sbPage.page).toHaveURL(`${storybookUrl}/?path=/docs/all-ui--docs`);

    // Wait for the dom content to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that the page container is visible
    await expect(root.locator('.page')).toBeVisible();

    const loggedIn = (await root.locator('h3', { hasText: 'LoggedIn' }).all())[1];

    // Check for the visibility of the Header
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();

    // Expand the 'LoggedIn' story and check its elements
    await loggedIn.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode = root.locator('pre.prismjs');
    const expectedSource = dedent`
      <Page />
    `;
    const actualSourceCode = await sourceCode.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(actualSourceCode).toBe(expectedSource);

    // Close the 'LoggedIn' story
    await loggedIn.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedIn' })).not.toBeVisible();

    const loggedOut = (await root.locator('h3', { hasText: 'LoggedOut' }).all())[1];

    // Expand the 'LoggedOut' story and check its elements
    await loggedOut.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).toBeVisible();

    // Click on the third button which has the text "Show code"
    (await root.locator('button', { hasText: 'Show Code' }).all())[0].click();
    const sourceCode2 = root.locator('pre.prismjs');
    const expectedSource2 = dedent`
      <Page />
    `;
    const actualSourceCode2 = await sourceCode2.evaluate(
      (el) => (el as HTMLElement).textContent?.trim() || ''
    );
    await expect(actualSourceCode2).toBe(expectedSource2);

    // Close the 'LoggedOut' story
    await loggedOut.click();
    await expect(root.locator('h3.expanded', { hasText: 'LoggedOut' })).not.toBeVisible();
  });
});
