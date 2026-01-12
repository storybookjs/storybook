import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseVitestResults } from './parse-vitest-report';

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

      expect(result.success).toBe(true);
      expect(result.summary).toEqual({
        total: 3,
        passed: 3,
        passedButEmptyRender: 0,
        failed: 0,
        successRate: 1.0,
        successRateWithoutEmptyRender: 1.0,
        failureRate: 0.0,
        uniqueErrorCount: 0,
        categorizedErrors: {},
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

      expect(result.success).toBe(false);
      expect(result.summary?.total).toBe(3);
      expect(result.summary?.passed).toBe(1);
      expect(result.summary?.failed).toBe(2);
      expect(result.summary?.successRate).toBe(0.33);
      expect(result.summary?.failureRate).toBe(0.67);
      expect(result.summary?.uniqueErrorCount).toBe(2);
    });

    it('should categorize errors and include them in the summary', () => {
      const mockVitestResults = {
        success: false,
        numTotalTests: 4,
        numPassedTests: 1,
        numFailedTests: 3,
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
                failureMessages: ['Error: Module not found: react-router\n  at import statement'],
              },
              {
                fullName: 'Story4',
                status: 'failed',
                failureMessages: ['Error: Invalid hook call\n  at useEffect'],
              },
            ],
          },
        ],
      };

      const result = parseVitestResults(mockVitestResults);

      expect(result.success).toBe(false);
      expect(result.summary?.total).toBe(4);
      expect(result.summary?.passed).toBe(1);
      expect(result.summary?.failed).toBe(3);
      expect(result.summary?.uniqueErrorCount).toBe(3);
      expect(result.summary?.categorizedErrors).toEqual({
        HOOK_USAGE_ERROR: {
          count: 1,
          description: 'React hook was used incorrectly',
          matchedDependencies: [],
        },
        MISSING_THEME_PROVIDER: {
          count: 1,
          description: 'Component attempted to access theme values without a theme provider',
          matchedDependencies: ['styled-components'],
        },
        MODULE_IMPORT_ERROR: {
          count: 1,
          description: 'A required dependency could not be resolved',
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

      expect(result.summary?.passedButEmptyRender).toBe(2);
      expect(result.summary?.successRate).toBe(1.0);
      expect(result.summary?.successRateWithoutEmptyRender).toBe(0.33);
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

      expect(result.summary?.total).toBe(4);
      expect(result.summary?.passed).toBe(3);
      expect(result.summary?.failed).toBe(1);
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

      expect(result.summary?.total).toBe(0);
      expect(result.summary?.successRate).toBe(0);
      expect(result.summary?.failureRate).toBe(0);
    });
  });
});
