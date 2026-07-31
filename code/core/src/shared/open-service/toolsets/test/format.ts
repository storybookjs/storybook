import type { TestRunOutput } from './definition.ts';

/** Formats a test run result as a compact summary for humans and agents. */
export function formatTestRun(output: TestRunOutput): string {
  switch (output.status) {
    case 'no-stories':
      return '# No stories matched\nNo story tests were run.';
    case 'error':
      return `# Test run failed\n${output.error.message}`;
    case 'cancelled':
      return '# Test run cancelled\nThe test run was cancelled.';
    case 'completed': {
      const { componentTestCount, a11yCount, totalTestCount } = output.result;
      const total =
        totalTestCount ??
        componentTestCount.success +
          componentTestCount.error +
          a11yCount.success +
          a11yCount.warning +
          a11yCount.error;

      return [
        '# Test run completed',
        `- Total tests: ${total}`,
        `- Component tests: ${componentTestCount.success} passed, ${componentTestCount.error} failed`,
        `- Accessibility tests: ${a11yCount.success} passed, ${a11yCount.warning} warnings, ${a11yCount.error} failed`,
      ].join('\n');
    }
  }
}
