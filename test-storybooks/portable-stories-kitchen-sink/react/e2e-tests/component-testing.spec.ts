import { promises as fs } from "node:fs";
import path from "node:path";


import { expect, test } from "@playwright/test";

import { SbPage } from "../../../../code/e2e-tests/util";

const STORYBOOK_URL = "http://localhost:6006";
const TEST_STORY_PATH = path.resolve(__dirname, "..", "stories", "AddonTest.stories.tsx");

const setForceFailureFlag = async (value: boolean) => {
  // Read the story file content asynchronously
  const storyContent = (await fs.readFile(TEST_STORY_PATH)).toString();

  // Create a regex to match 'forceFailure: true' or 'forceFailure: false'
  const forceFailureRegex = /forceFailure:\s*(true|false)/;

  // Replace the value of 'forceFailure' with the new value
  const updatedContent = storyContent.replace(
    forceFailureRegex,
    `forceFailure: ${value}`
  );

  // Write the updated content back to the file asynchronously
  await fs.writeFile(TEST_STORY_PATH, updatedContent);

  // the file change causes a HMR event, which causes a browser reload,and that can take a few seconds
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

test.describe("component testing", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await page.goto(STORYBOOK_URL);
    await page.evaluate(() => window.sessionStorage.clear());
    await sbPage.waitUntilLoaded();
  });

  test("should show discrepancy between test results", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    test.setTimeout(40_000)
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory("addons/group/test", "Mismatch Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await sbPage.viewAddonPanel("Component tests");

    // For whatever reason, when visiting a story sometimes the story element is collapsed and that causes flake
    const testStoryElement = await page.getByRole("button", {
      name: "Test",
      exact: true,
    });
    if ((await testStoryElement.getAttribute("aria-expanded")) !== "true") {
      testStoryElement.click();
    }

    const testingModuleDescription = await page.locator('#testing-module-description');

    await expect(testingModuleDescription).toContainText('Not run');

    const runTestsButton = await page.getByLabel('Start test run')
    await runTestsButton.click();

    await expect(testingModuleDescription).toContainText('Testing', { timeout: 60000 });

    // Wait for test results to appear
    await expect(testingModuleDescription).toHaveText(/Ran \d+ tests/, { timeout: 60000 });

    const errorFilter = page.getByLabel("Toggle errors");
    await expect(errorFilter).toBeVisible();

    // Assert discrepancy: CLI pass + Browser fail
    const failingStoryElement = page.locator(
      '[data-item-id="addons-group-test--mismatch-failure"] [role="status"]'
    );
    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );
    await expect(sbPage.panelContent()).toContainText(
      /This component test passed in the CLI, but the tests failed in this browser/
    );

    // Assert discrepancy: CLI fail + Browser pass
    await sbPage.navigateToStory("addons/group/test", "Mismatch Success");
    const successfulStoryElement = page.locator(
      '[data-item-id="addons-group-test--mismatch-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );
    await expect(sbPage.panelContent()).toContainText(
      /This component test passed in this browser, but the tests failed in the CLI/
    );
  });

  test("should execute tests via testing module UI", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await setForceFailureFlag(true);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = page.getByLabel('Expand testing module')
    await expandButton.click();

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await expect(page.locator('#testing-module-title')).toHaveText('Run local tests');

    const testingModuleDescription = await page.locator('#testing-module-description');

    await expect(testingModuleDescription).toContainText('Not run');

    const runTestsButton = await page.getByLabel('Start test run')
    const watchModeButton = await page.getByLabel('Enable watch mode')
    await expect(runTestsButton).toBeEnabled();
    await expect(watchModeButton).toBeEnabled();

    await runTestsButton.click();
    await expect(watchModeButton).toBeDisabled();

    await expect(testingModuleDescription).toContainText('Testing');

    // Wait for test results to appear
    await expect(testingModuleDescription).toHaveText(/Ran \d+ tests/, { timeout: 30000 });

    await expect(runTestsButton).toBeEnabled();
    await expect(watchModeButton).toBeEnabled();

    const errorFilter = page.getByLabel("Toggle errors");
    await expect(errorFilter).toBeVisible();

    // Assert for expected success
    const successfulStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-failure"] [role="status"]'
    );
    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );

    // Assert that filter works as intended
    await errorFilter.click();

    const sidebarItems = page.locator(
      '.sidebar-item[data-ref-id="storybook_internal"][data-nodetype="component"]'
    );
    await expect(sidebarItems).toHaveCount(2);
  });

  test("should execute watch mode tests via testing module UI", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(8000);
    await setForceFailureFlag(true);
    await page.waitForTimeout(500);

    // Cleanup, to ensure watch mode is disabled in the other tests
    await page.getByLabel("Disable watch mode").click();

    // Wait for test results to appear
    const errorFilter = page.getByLabel("Toggle errors");
    await expect(errorFilter).toBeVisible({ timeout: 30000 });

    // Assert for expected success
    const successfulStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-failure"] [role="status"]'
    );
    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );

    // Assert that filter works as intended
    await errorFilter.click();

    const sidebarItems = page.locator(
      '.sidebar-item[data-ref-id="storybook_internal"][data-nodetype="component"]'
    );
    await expect(sidebarItems).toHaveCount(1);
  });

  test("should collect coverage to testing module and HTML report", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Assert - No coverage report initially
    await expect(page.getByLabel("Open coverage report")).toHaveCount(0);

    // Act - Enable coverage and run tests
    await page.getByLabel("Show settings").click();
    await page.getByLabel("Coverage").click();
    await expect(page.getByText("Settings updated")).toBeVisible({ timeout: 3000 });
    await page.getByLabel("Hide settings").click();
    // Wait for Vitest to have (re)started
    await page.waitForTimeout(2000);

    await page.getByLabel("Start test run").click();

    // Assert - Coverage report is collected and shown
    await expect(page.getByLabel("Open coverage report")).toBeVisible({ timeout: 30000 });
    const sbPercentageText = await page.getByLabel(/percent coverage$/).textContent();
    expect(sbPercentageText).toMatch(/^\d+\s%$/);
    const sbPercentage = Number.parseInt(sbPercentageText!.replace(' %', '') ?? '');
    expect(sbPercentage).toBeGreaterThanOrEqual(0);
    expect(sbPercentage).toBeLessThanOrEqual(100);

    // Act - Open HTML coverage report
    const coverageReportLink = await page.getByLabel("Open coverage report");
    // Remove target="_blank" attribute to open in the same tab
    await coverageReportLink.evaluate((elem) => elem.removeAttribute("target"));
    await page.getByLabel("Open coverage report").click();

    // Assert - HTML coverage report is accessible and reports the same coverage percentage as Storybook
    const htmlPercentageText = await page.locator('span:has(+ :text("Statements"))').first().textContent() ?? '';
    const htmlPercentage = Number.parseFloat(htmlPercentageText.replace('% ', ''));
    expect(Math.round(htmlPercentage)).toBe(sbPercentage);

    // Cleanup - Disable coverage again
    await page.goBack();
    await expandButton.click();
    await page.getByLabel("Show settings").click();
    await page.getByLabel("Coverage").click();
    await expect(page.getByText("Settings updated")).toBeVisible({ timeout: 3000 });
  });

  test("should run focused test for a single story", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="addons-group-test--expected-failure"]').hover();
    await page.locator('[data-item-id="addons-group-test--expected-failure"] div[data-testid="context-menu"] button').click();
    const sidebarContextMenu = page.getByTestId('tooltip');
    await sidebarContextMenu.getByLabel('Start test run').click();

    // Assert - Only one test is running and reported
    await expect(sidebarContextMenu.locator('#testing-module-description')).toContainText('Ran 1 test', { timeout: 30000 });
    await expect(sidebarContextMenu.getByLabel('status: passed')).toHaveCount(1);
    await page.click('body');
    await expect(page.locator('#storybook-explorer-menu').getByRole('status', { name: 'Test status: success' })).toHaveCount(1);
  });

  test("should run focused test for a component", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="addons-group-test"]').hover();
    await page.locator('[data-item-id="addons-group-test"] div[data-testid="context-menu"] button').click();
    const sidebarContextMenu = page.getByTestId('tooltip');
    await sidebarContextMenu.getByLabel('Start test run').click();

    // Assert - Tests are running and reported
    await expect(sidebarContextMenu.locator('#testing-module-description')).toContainText('Ran 8 tests', { timeout: 30000 });
    // Assert - Failing test shows as a failed status
    await expect(sidebarContextMenu.getByText('1 story with errors')).toBeVisible();
    await expect(sidebarContextMenu.getByLabel('status: failed')).toHaveCount(1);

    await page.click('body');
    await expect(page.locator('#storybook-explorer-menu').getByRole('status', { name: 'Test status: success' })).toHaveCount(7);
    await expect(page.locator('#storybook-explorer-menu').getByRole('status', { name: 'Test status: error' })).toHaveCount(1);
  });

  test("should run focused test for a group", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="addons-group"]').hover();
    await page.locator('[data-item-id="addons-group"] div[data-testid="context-menu"] button').click();
    const sidebarContextMenu = page.getByTestId('tooltip');
    await sidebarContextMenu.getByLabel('Start test run').click();

    // Assert - Tests are running and reported
    await expect(sidebarContextMenu.locator('#testing-module-description')).toContainText('Ran 10 test', { timeout: 30000 });
    // Assert - 1 failing test shows as a failed status
    await expect(sidebarContextMenu.getByText('2 stories with errors')).toBeVisible();
    await expect(sidebarContextMenu.getByLabel('status: failed')).toHaveCount(1);

    await page.click('body');
    await expect(page.locator('#storybook-explorer-menu').getByRole('status', { name: 'Test status: success' })).toHaveCount(7);
    await expect(page.locator('#storybook-explorer-menu').getByRole('status', { name: 'Test status: error' })).toHaveCount(1);
  });

  test("should run focused tests without coverage, even when enabled", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("example/button", "CSF 3 Primary");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "foo" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Enable coverage
    await page.getByLabel("Show settings").click();
    await page.getByLabel("Coverage").click();
    await expect(page.getByText("Settings updated")).toBeVisible({ timeout: 3000 });
    await page.getByLabel("Hide settings").click();
    // Wait for Vitest to have (re)started
    await page.waitForTimeout(2000);

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="example-button--csf-3-primary"]').hover();
    await page.locator('[data-item-id="example-button--csf-3-primary"] div[data-testid="context-menu"] button').click();
    const sidebarContextMenu = page.getByTestId('tooltip');
    await sidebarContextMenu.getByLabel('Start test run').click();

    // Arrange - Wait for test to finish and unfocus sidebar context menu
    await expect(sidebarContextMenu.locator('#testing-module-description')).toContainText('Ran 1 test', { timeout: 30000 });
    await page.click('body');

    // Assert - Coverage is not shown because Focused Tests shouldn't collect coverage
    await expect(page.getByLabel("Open coverage report")).not.toBeVisible();

    // Act - Run ALL tests
    await page.getByLabel("Start test run").click();

    // Arrange - Wait for tests to finish
    await expect(page.locator('#testing-module-description')).toContainText(/Ran \d{2,} tests/, { timeout: 30000 });

    // Assert - Coverage percentage is now collected and shown because running all tests automatically re-enables coverage
    await expect(page.getByLabel("Open coverage report")).toBeVisible({ timeout: 30000 });
    const sbPercentageText = await page.getByLabel(/percent coverage$/).textContent();
    expect(sbPercentageText).toMatch(/^\d+\s%$/);
    const sbPercentage = Number.parseInt(sbPercentageText!.replace(' %', '') ?? '');
    expect(sbPercentage).toBeGreaterThanOrEqual(0);
    expect(sbPercentage).toBeLessThanOrEqual(100);
  });

});
