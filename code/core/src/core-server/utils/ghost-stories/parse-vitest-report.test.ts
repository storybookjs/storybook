import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseVitestResults } from './parse-vitest-report.ts';

vi.mock('../../../shared/utils/categorize-render-errors', { spy: true });

describe('parse-vitest-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseVitestResults', () => {
    it('should parse basic vitest results with all passing tests', () => {
      const mockVitestResults = {
        success: true,
        numTotalTests: 3,
        numPassedTests: 3,
        numFailedTests: 0,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'Story1',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Story2',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Story3',
                status: 'passed',
                failureMessages: [],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary).toEqual({
        runTotal: 3,
        runPassed: 3,
        runPassedButEmptyRender: 0,
        runSuccessRate: 1.0,
        runSuccessRateWithoutEmptyRender: 1.0,
        runUniqueErrorCount: 0,
        runCategorizedErrors: {},
        runCssCheck: 'not-run',
        cumulativeTotal: 3,
        cumulativePassed: 3,
        cumulativePassedButEmptyRender: 0,
        cumulativeSuccessRate: 1.0,
        cumulativeSuccessRateWithoutEmptyRender: 1.0,
        cumulativeUniqueErrorCount: 0,
        cumulativeCategorizedErrors: {},
        cumulativeCssCheck: 'not-run',
      });
    });

    it('should parse vitest results with failed tests and extract error messages', () => {
      const mockVitestResults = {
        success: false,
        numTotalTests: 3,
        numPassedTests: 1,
        numFailedTests: 2,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'Story1',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Story2',
                status: 'failed',
                failureMessages: [
                  'Error: Cannot read property "x" of undefined\n  at Component.render',
                ],
              },
              {
                fullName: 'Story3',
                status: 'failed',
                failureMessages: ['Error: Module not found: react-router\n  at import statement'],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runTotal).toBe(3);
      expect(result.summary?.runPassed).toBe(1);
      expect(result.summary?.runSuccessRate).toBe(0.33);
      expect(result.summary?.runUniqueErrorCount).toBe(2);
    });

    it('should categorize errors and include them in the summary', () => {
      const mockVitestResults = {
        success: false,
        numTotalTests: 5,
        numPassedTests: 1,
        numFailedTests: 4,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'Story1',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Story2',
                status: 'failed',
                failureMessages: [
                  'Error: Cannot read property "x" of undefined\n  at /deps/styled-components.js:1168:14',
                ],
              },
              {
                fullName: 'Story3',
                status: 'failed',
                failureMessages: [
                  'Error: Cannot read property "x" of undefined\n  at /deps/styled-components.js:1168:14',
                ],
              },
              {
                fullName: 'Story4',
                status: 'failed',
                failureMessages: ['Error: Module not found: react-router\n  at import statement'],
              },
              {
                fullName: 'Story5',
                status: 'failed',
                failureMessages: ['Error: Invalid hook call\n  at useEffect'],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runTotal).toBe(5);
      expect(result.summary?.runPassed).toBe(1);
      expect(result.summary?.runUniqueErrorCount).toBe(3);
      expect(result.summary?.runCategorizedErrors).toEqual({
        HOOK_USAGE_ERROR: {
          uniqueCount: 1,
          count: 1,
          matchedDependencies: [],
        },
        MISSING_THEME_PROVIDER: {
          uniqueCount: 1,
          count: 2,
          matchedDependencies: ['styled-components'],
        },
        MODULE_IMPORT_ERROR: {
          uniqueCount: 1,
          count: 1,
          matchedDependencies: [],
        },
      });
    });

    it('should detect empty render reports', () => {
      const mockVitestResults = {
        success: true,
        numTotalTests: 3,
        numPassedTests: 3,
        numFailedTests: 0,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'Story1',
                status: 'passed',
                meta: {
                  reports: [{ type: 'render-analysis', result: { emptyRender: false } }],
                },
                failureMessages: [],
              },
              {
                fullName: 'Story2',
                status: 'passed',
                meta: {
                  reports: [{ type: 'render-analysis', result: { emptyRender: true } }],
                },
                failureMessages: [],
              },
              {
                fullName: 'Story3',
                status: 'passed',
                meta: {
                  reports: [{ type: 'render-analysis', result: { emptyRender: true } }],
                },
                failureMessages: [],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runPassedButEmptyRender).toBe(2);
      expect(result.summary?.runSuccessRate).toBe(1.0);
      expect(result.summary?.runSuccessRateWithoutEmptyRender).toBe(0.33);
    });

    it('should handle multiple test suites', () => {
      const mockVitestResults = {
        success: true,
        numTotalTests: 4,
        numPassedTests: 3,
        numFailedTests: 1,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'Suite1-Story1',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Suite1-Story2',
                status: 'failed',
                failureMessages: ['Error: Test failed'],
              },
            ],
          },
          {
            assertionResults: [
              {
                fullName: 'Suite2-Story1',
                status: 'passed',
                failureMessages: [],
              },
              {
                fullName: 'Suite2-Story2',
                status: 'passed',
                failureMessages: [],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runTotal).toBe(4);
      expect(result.summary?.runPassed).toBe(3);
    });

    it('should handle zero total tests', () => {
      const mockVitestResults = {
        success: true,
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        testResults: [],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runTotal).toBe(0);
      expect(result.summary?.runSuccessRate).toBe(0);
    });

    it('surfaces the CssCheck story outcome via summary.runCssCheck', () => {
      const mockVitestResults = {
        success: false,
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1,
        testResults: [
          {
            assertionResults: [
              {
                fullName: 'components-button--primary',
                status: 'passed',
                meta: { storyId: 'components-button--primary' },
                failureMessages: [],
              },
              {
                fullName: 'components-button--css-check',
                status: 'failed',
                meta: { storyId: 'components-button--css-check' },
                failureMessages: ['Error: expected rgb(37, 99, 235) but got rgba(0, 0, 0, 0)'],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.summary?.runCssCheck).toBe('fail');
    });
  });
});
