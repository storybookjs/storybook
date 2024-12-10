import { promises as fs } from "node:fs";
import path from "node:path";


import { expect, test } from "@playwright/test";

import { SbPage } from "../../../../code/e2e-tests/util";

const storybookUrl = "http://localhost:6006";
const testStoryPath = path.resolve(
  __dirname,
  "..",
  "stories/AddonTest.stories.tsx"
);

const setForceFailureFlag = async (value: boolean) => {
  // Read the story file content asynchronously
  const storyContent = (await fs.readFile(testStoryPath)).toString();

  // Create a regex to match 'forceFailure: true' or 'forceFailure: false'
  const forceFailureRegex = /forceFailure:\s*(true|false)/;

  // Replace the value of 'forceFailure' with the new value
  const updatedContent = storyContent.replace(
    forceFailureRegex,
    `forceFailure: ${value}`
  );

  // Write the updated content back to the file asynchronously
  await fs.writeFile(testStoryPath, updatedContent);
};

test.describe("component testing", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    const sbPage = new SbPage(page, expect);

    await page.goto(storybookUrl);
    await page.evaluate(() => window.sessionStorage.clear());
    await sbPage.waitUntilLoaded();
  });

  test("should show discrepancy between test results", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory("addons/test", "Mismatch Failure");

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

    const runTestsButton = await page.getByLabel('Start Component tests')
    await runTestsButton.click();

    await expect(testingModuleDescription).toContainText('Testing', { timeout: 60000 });

    // Wait for test results to appear
    await expect(testingModuleDescription).toHaveText(/Ran \d+ tests/, { timeout: 60000 });

    const errorFilter = page.getByLabel("Toggle errors");
    await expect(errorFilter).toBeVisible();

    // Assert discrepancy: CLI pass + Browser fail
    const failingStoryElement = page.locator(
      '[data-item-id="addons-test--mismatch-failure"] [role="status"]'
    );
    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );
    await expect(sbPage.panelContent()).toContainText(
      /This component test passed in CLI, but the tests failed in this browser./
    );

    // Assert discrepancy: CLI fail + Browser pass
    await sbPage.navigateToStory("addons/test", "Mismatch Success");
    const successfulStoryElement = page.locator(
      '[data-item-id="addons-test--mismatch-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );
    await expect(sbPage.panelContent()).toContainText(
      /This component test passed in this browser, but the tests failed in CLI/
    );
  });

  test("should execute tests via testing module UI", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await setForceFailureFlag(true);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/test", "Expected Failure");

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

    const runTestsButton = await page.getByLabel('Start Component Tests')
    const watchModeButton = await page.getByLabel('Enable watch mode for Component tests')
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
      '[data-item-id="addons-test--expected-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-test--expected-failure"] [role="status"]'
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

  test("should execute watch mode tests via testing module UI", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await setForceFailureFlag(false);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/test", "Expected Failure");

    const expandButton = await page.getByLabel('Expand testing module')
    await expandButton.click();

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode for Component tests").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(8000);

    await setForceFailureFlag(true);

    // Wait for test results to appear
    const errorFilter = page.getByLabel("Toggle errors");
    await expect(errorFilter).toBeVisible({ timeout: 30000 });

    // Assert for expected success
    const successfulStoryElement = page.locator(
      '[data-item-id="addons-test--expected-success"] [role="status"]'
    );
    await expect(successfulStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: success"
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-test--expected-failure"] [role="status"]'
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
});
