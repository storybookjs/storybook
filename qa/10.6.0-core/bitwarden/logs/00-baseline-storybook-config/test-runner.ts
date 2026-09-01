import { type TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const testRunnerConfig: TestRunnerConfig = {
  setup() {},

  async preVisit(page, context) {
    return await injectAxe(page);
  },

  async postVisit(page, context) {
    await page.waitForSelector('#storybook-root');
    // https://github.com/abhinaba-ghosh/axe-playwright#parameters-on-checka11y-axerun
    await checkA11y(
      // Playwright page instance.
      page,

      // context
      {
        include: ['#storybook-root', '.cdk-overlay-container'],
        exclude: ['.cdk-visually-hidden'],
      },

      // axeOptions, see https://www.deque.com/axe/core-documentation/api-documentation/#parameters-axerun
      {
        detailedReport: true,
        detailedReportOptions: {
          // Includes the full html for invalid nodes
          html: true,
        },
        verbose: false,
      },

      // skipFailures
      false,

      // reporter "v2" is terminal reporter, "html" writes results to file
      'v2',

      // axeHtmlReporterOptions
      // NOTE: set reporter param (above) to "html" to activate these options
      {
        outputDir: 'reports/a11y',
        reportFileName: `${context.id}.html`,
      }
    );
  },
};

export default testRunnerConfig;
