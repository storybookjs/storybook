import { promises as fs } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { SbPage } from "../../../../code/e2e-tests/util";

const STORYBOOK_URL = "http://localhost:6006";
const TEST_STORY_PATH = path.resolve(
  __dirname,
  "..",
  "stories",
  "AddonTest.stories.tsx"
);
const UNHANDLED_ERRORS_STORY_PATH = path.resolve(
  __dirname,
  "..",
  "stories",
  "UnhandledErrors.stories.tsx"
);
const ADDON_TEST_DEPENDENCY_PATH = path.resolve(
  __dirname,
  "..",
  "stories",
  "get-button-string.ts"
);
const PREVIEW_DEPENDENCY_PATH = path.resolve(
  __dirname,
  "..",
  ".storybook",
  "get-decorator-string.ts"
);
const SETUP_FILE_DEPENDENCY_PATH = path.resolve(
  __dirname,
  "..",
  ".storybook",
  "setup-file-dependency.ts"
);

const setForceFailureFlag = (content: string, value: boolean) =>
  content.replace(/forceFailure:\s*(true|false)/, `forceFailure: ${value}`);

const modifiedFiles = new Map<string, string>();

const modifyFile = async (
  filePath: string,
  modify: (content: string) => string
) => {
  const content = (await fs.readFile(filePath)).toString();
  const modifiedContent = modify(content);
  await fs.writeFile(filePath, modifiedContent);
  if (!modifiedFiles.has(filePath)) {
    modifiedFiles.set(filePath, content);
  }

  // the file change causes a HMR event, which causes a browser reload,and that can take a few seconds
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const restoreAllFiles = async () => {
  for (const [filePath, originalContent] of modifiedFiles.entries()) {
    await fs.writeFile(filePath, originalContent);
  }
  modifiedFiles.clear();
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

    const expandTestingModule = page.getByLabel("Expand testing module");
    if (await expandTestingModule.isVisible()) {
      await expandTestingModule.click();
    }
  });

  test.afterEach(async ({ page }) => {
    await restoreAllFiles();

    const expandTestingModule = page.getByLabel("Expand testing module");
    if (await expandTestingModule.isVisible()) {
      await expandTestingModule.click();
    }

    // Ensure that all test results are removed and features are disabled, as previous tests might have enabled them
    const clearStatusesButton = page.getByLabel("Clear all statuses");
    if (await clearStatusesButton.isVisible()) {
      await clearStatusesButton.click();
    }

    const disableWatch = page.getByLabel("Disable watch mode");
    if (await disableWatch.isVisible()) {
      await disableWatch.click();
    }

    const configs = [
      page.getByLabel("Coverage", { exact: true }),
      page.getByLabel("Accessibility", { exact: true }),
    ];
    for (const config of configs) {
      if (await config.isChecked()) {
        await config.click();
      }
    }
  });

  test("should show discrepancy between test results", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    test.setTimeout(40_000);
    const sbPage = new SbPage(page, expect);

    await sbPage.navigateToStory("addons/group/test", "Mismatch Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await sbPage.viewAddonPanel("Interactions");

    // For whatever reason, when visiting a story sometimes the story element is collapsed and that causes flake
    const testStoryElement = await page.getByRole("button", {
      name: "Test",
      exact: true,
    });
    if ((await testStoryElement.getAttribute("aria-expanded")) !== "true") {
      testStoryElement.click();
    }

    const testingModuleDescription = await page.locator(
      "#testing-module-description"
    );

    const runTestsButton = await page.getByLabel("Start test run");
    await runTestsButton.click();

    await expect(testingModuleDescription).not.toContainText(/Ran \d+ tests/, {
      timeout: 60000,
    });

    // Wait for test results to appear
    await expect(testingModuleDescription).toHaveText(/Ran \d+ tests/, {
      timeout: 60000,
    });

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
      /This interaction test passed in the CLI, but the tests failed in this browser/
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
      /This interaction test passed in this browser, but the tests failed in the CLI/
    );
  });

  test("should execute tests via testing module UI", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, true)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await expect(page.locator("#testing-module-title")).toHaveText(
      "Run component tests"
    );

    const runTestsButton = await page.getByLabel("Start test run");
    const watchModeButton = await page.getByLabel("Enable watch mode");
    await expect(runTestsButton).toBeEnabled();
    await expect(watchModeButton).toBeEnabled();

    await runTestsButton.click();

    // Wait for both the watch mode button to be disabled and the testing text to appear
    await Promise.all([
      expect(watchModeButton).toHaveAttribute("aria-disabled", true),
      expect(page.locator("#testing-module-description")).toHaveText(/Testing/),
    ]);

    // Wait for test results to appear
    await expect(page.locator("#testing-module-description")).toHaveText(
      /Ran \d+ tests/,
      { timeout: 30000 }
    );

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

  test("should run tests in watch mode when a story file is changed", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(8000);
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, true)
    );

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

  test("should run tests in watch mode when a story file's dependency is changed", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(3000);
    await modifyFile(ADDON_TEST_DEPENDENCY_PATH, (content) =>
      content.replace("test", "changed")
    );

    // Expect less than 10 tests to have run
    await expect(page.locator("#testing-module-description")).toContainText(
      /Ran \d tests/,
      { timeout: 30000 }
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-content"] [role="status"]'
    );
    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );
  });

  test("should run all tests in watch mode when the preview file's dependency is changed", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(3000);
    await modifyFile(PREVIEW_DEPENDENCY_PATH, (content) =>
      content.replace("Global Decorator", "Changed Decorator")
    );

    // Expect at least 20 tests to have run
    await expect(page.locator("#testing-module-description")).toContainText(
      /Ran [2-9]\d tests/,
      { timeout: 30000 }
    );

    // Assert for expected failure
    const failingStoryElement = page.locator(
      '[data-item-id="addons-group-test--expected-content"] [role="status"]'
    );

    await expect(failingStoryElement).toHaveAttribute(
      "aria-label",
      "Test status: error"
    );
  });

  test("should run all tests in watch mode when the setup file's dependency is changed", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    // For whatever reason, sometimes it takes longer for the story to load
    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Enable watch mode").click();

    // We shouldn't have to do an arbitrary wait, but because there is no UI for loading state yet, we have to
    await page.waitForTimeout(3000);
    await modifyFile(SETUP_FILE_DEPENDENCY_PATH, (content) =>
      content.replace("initial string", "changed string")
    );

    // Expect at least 20 tests to have run
    await expect(page.locator("#testing-module-description")).toContainText(
      /Ran [2-9]\d tests/,
      { timeout: 30000 }
    );
  });

  test("should collect coverage to testing module and HTML report", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Assert - No coverage report initially
    await expect(page.getByLabel("Open coverage report")).toHaveCount(0);

    // Act - Enable coverage and run tests
    await page.getByLabel("Coverage", { exact: true }).click();
    // Wait for Vitest to have (re)started
    await page.waitForTimeout(2000);

    await page.getByLabel("Start test run").click();

    // Assert - Coverage report is collected and shown
    await expect(page.getByLabel("Open coverage report")).toBeVisible({
      timeout: 30000,
    });
    const sbPercentageText = await page
      .getByLabel(/percent coverage$/)
      .textContent();
    expect(sbPercentageText).toMatch(/^\d+%$/);
    const sbPercentage = Number.parseInt(
      sbPercentageText!.replace("%", "") ?? ""
    );
    expect(sbPercentage).toBeGreaterThanOrEqual(0);
    expect(sbPercentage).toBeLessThanOrEqual(100);

    // Act - Open HTML coverage report
    const coverageReportLink = await page.getByLabel("Open coverage report");
    // Remove target="_blank" attribute to open in the same tab
    await coverageReportLink.evaluate((elem) => elem.removeAttribute("target"));
    await page.getByLabel("Open coverage report").click();

    // Assert - HTML coverage report is accessible and reports the same coverage percentage as Storybook
    const htmlPercentageText =
      (await page
        .locator('span:has(+ :text("Statements"))')
        .first()
        .textContent()) ?? "";
    const htmlPercentage = Number.parseFloat(
      htmlPercentageText.replace("% ", "")
    );
    expect(Math.round(htmlPercentage)).toBe(sbPercentage);

    await page.goBack();
  });

  test("should run focused test for a single story", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page
      .locator('[data-item-id="addons-group-test--expected-failure"]')
      .hover();
    await page
      .locator(
        '[data-item-id="addons-group-test--expected-failure"] div[data-testid="context-menu"] button'
      )
      .click();
    const sidebarContextMenu = page.getByTestId("tooltip");
    await sidebarContextMenu.getByLabel("Start test run").click();

    // Assert - Only one test is running and reported
    await expect(
      sidebarContextMenu.locator("#testing-module-description")
    ).toContainText("Ran 1 test", { timeout: 30000 });
    await expect(
      sidebarContextMenu.getByLabel("Component tests passed")
    ).toHaveCount(1);
    await page.click("body");
    await expect(
      page
        .locator("#storybook-explorer-menu")
        .getByRole("status", { name: "Test status: success" })
    ).toHaveCount(1);
  });

  test("should show unhandled errors in the testing module", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(UNHANDLED_ERRORS_STORY_PATH, (content) =>
      setForceFailureFlag(content, true)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("example/unhandlederrors", "Success");

    const storyElement = sbPage.getCanvasBodyElement().getByText("Hello world");
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="example-unhandlederrors"]').hover();
    await page
      .locator(
        '[data-item-id="example-unhandlederrors"] div[data-testid="context-menu"] button'
      )
      .click();
    const sidebarContextMenu = page.getByTestId("tooltip");
    await sidebarContextMenu.getByLabel("Start test run").click();

    // Assert - Tests are running and errors are reported
    const errorLink = page.locator(
      "#storybook-testing-module #testing-module-description a"
    );
    await expect(errorLink).toContainText("View full error", {
      timeout: 30000,
    });
    await errorLink.click();

    await expect(page.locator("pre")).toContainText(
      "I THREW AN UNHANDLED ERROR!"
    );
    await expect(page.locator("pre")).toContainText("This error originated in");
    await expect(page.locator("pre")).toContainText(
      "The latest test that might've caused the error is"
    );
    await page.getByLabel("Close modal").click();
  });

  test("should run focused test for a component", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="addons-group-test"]').hover();
    await page
      .locator(
        '[data-item-id="addons-group-test"] div[data-testid="context-menu"] button'
      )
      .click();
    const sidebarContextMenu = page.getByTestId("tooltip");
    await sidebarContextMenu.getByLabel("Start test run").click();

    // Assert - Tests are running and reported
    await expect(
      sidebarContextMenu.locator("#testing-module-description")
    ).toContainText("Ran 9 tests", { timeout: 30000 });
    // Assert - Failing test shows as a failed status
    await expect(
      sidebarContextMenu.getByText("1 story with errors")
    ).toBeVisible();
    await expect(
      sidebarContextMenu.getByLabel("Component tests failed")
    ).toHaveCount(1);

    await page.click("body");
    await expect(
      page
        .locator("#storybook-explorer-menu")
        .getByRole("status", { name: "Test status: success" })
    ).toHaveCount(8);
    await expect(
      page
        .locator("#storybook-explorer-menu")
        .getByRole("status", { name: "Test status: error" })
    ).toHaveCount(1);
  });

  test("should run focused test for a group", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("addons/group/test", "Expected Failure");

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "test" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Open sidebar context menu and start focused test
    await page.locator('[data-item-id="addons-group"]').hover();
    await page
      .locator(
        '[data-item-id="addons-group"] div[data-testid="context-menu"] button'
      )
      .click();
    const sidebarContextMenu = page.getByTestId("tooltip");
    await sidebarContextMenu.getByLabel("Start test run").click();

    // Assert - Tests are running and reported
    await expect(
      sidebarContextMenu.locator("#testing-module-description")
    ).toContainText("Ran 11 tests", { timeout: 30000 });
    // Assert - 1 failing test shows as a failed status
    await expect(
      sidebarContextMenu.getByText("2 stories with errors")
    ).toBeVisible();
    await expect(
      sidebarContextMenu.getByLabel("Component tests failed")
    ).toHaveCount(1);

    await page.click("body");
    await expect(
      page
        .locator("#storybook-explorer-menu")
        .getByRole("status", { name: "Test status: success" })
    ).toHaveCount(8);
    await expect(
      page
        .locator("#storybook-explorer-menu")
        .getByRole("status", { name: "Test status: error" })
    ).toHaveCount(1);
  });

  test("should run focused tests without coverage, even when enabled", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", `Skipping tests for ${browserName}`);
    // Arrange - Prepare Storybook
    await modifyFile(TEST_STORY_PATH, (content) =>
      setForceFailureFlag(content, false)
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory("example/button", "CSF 3 Primary");

    const storyElement = sbPage
      .getCanvasBodyElement()
      .getByRole("button", { name: "foo" });
    await expect(storyElement).toBeVisible({ timeout: 30000 });

    // Act - Enable coverage
    await page.getByLabel("Coverage", { exact: true }).click();
    // Wait for Vitest to have (re)started
    await page.waitForTimeout(2000);

    // Act - Open sidebar context menu and start focused test
    await page
      .locator('[data-item-id="example-button--csf-3-primary"]')
      .hover();
    await page
      .locator(
        '[data-item-id="example-button--csf-3-primary"] div[data-testid="context-menu"] button'
      )
      .click();
    const sidebarContextMenu = page.getByTestId("tooltip");
    await sidebarContextMenu.getByLabel("Start test run").click();

    // Arrange - Wait for test to finish and unfocus sidebar context menu
    await expect(
      sidebarContextMenu.locator("#testing-module-description")
    ).toContainText("Ran 1 test", { timeout: 30000 });
    await page.click("body");

    // Assert - Coverage is not shown because Focused Tests shouldn't collect coverage
    await expect(page.getByLabel("Open coverage report")).not.toBeVisible();

    // Act - Run ALL tests
    await page.getByLabel("Start test run").click();

    // Arrange - Wait for tests to finish
    await expect(page.locator("#testing-module-description")).toContainText(
      /Ran \d{2,} tests/,
      { timeout: 30000 }
    );

    // Assert - Coverage percentage is now collected and shown because running all tests automatically re-enables coverage
    await expect(page.getByLabel("Open coverage report")).toBeVisible({
      timeout: 30000,
    });
    const sbPercentageText = await page
      .getByLabel(/percent coverage$/)
      .textContent();
    expect(sbPercentageText).toMatch(/^\d+%$/);
    const sbPercentage = Number.parseInt(
      sbPercentageText!.replace("%", "") ?? ""
    );
    expect(sbPercentage).toBeGreaterThanOrEqual(0);
    expect(sbPercentage).toBeLessThanOrEqual(100);
  });

  test.fixme(
    "should still collect statuses even when the browser is closed",
    () => {}
  );

  test.fixme(
    "should have correct status count globally and in context menus",
    () => {}
  );

  test.fixme(
    "should open the correct component test and a11y panels when clicking on statuses",
    () => {}
  );
});
