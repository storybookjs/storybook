import { describe, expect, it, vi } from 'vitest';

import { analyzeTestResults, extractCategorizedErrors } from './analyze-test-results.ts';
import type { StoryTestResult } from './test-result-types.ts';

vi.mock('./categorize-render-errors', { spy: true });

describe('analyze-test-results', () => {
  describe('extractCategorizedErrors', () => {
    it('should return empty results for all-passing tests', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS' },
      ];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(0);
      expect(analysis.uniqueErrorCount).toBe(0);
      expect(analysis.categorizedErrors).toEqual({});
    });

    it('should categorize errors from failed tests', () => {
      const results: StoryTestResult[] = [
        {
          storyId: 's1',
          status: 'FAIL',
          error: 'Error: Cannot read property "x" of undefined',
          stack: 'at /deps/styled-components.js:1168:14',
        },
        {
          storyId: 's2',
          status: 'FAIL',
          error: 'Error: Cannot read property "x" of undefined',
          stack: 'at /deps/styled-components.js:1168:14',
        },
        {
          storyId: 's3',
          status: 'FAIL',
          error: 'Error: Module not found: react-router',
          stack: 'at import statement',
        },
      ];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(3);
      expect(analysis.uniqueErrorCount).toBe(2);
      expect(analysis.categorizedErrors['MISSING_THEME_PROVIDER']).toEqual({
        uniqueCount: 1,
        count: 2,
        matchedDependencies: ['styled-components'],
      });
      expect(analysis.categorizedErrors['MODULE_IMPORT_ERROR']).toEqual({
        uniqueCount: 1,
        count: 1,
        matchedDependencies: [],
      });
    });

    it('should skip failed tests without error messages', () => {
      const results: StoryTestResult[] = [{ storyId: 's1', status: 'FAIL' }];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(0);
    });
  });

  describe('analyzeTestResults', () => {
    it('should compute correct summary for all-passing tests', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS' },
        { storyId: 's3', status: 'PASS' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis).toEqual({
        total: 3,
        passed: 3,
        passedButEmptyRender: 0,
        passedButNoCss: 0,
        successRate: 1.0,
        successRateWithoutEmptyRender: 1.0,
        uniqueErrorCount: 0,
        categorizedErrors: {},
      });
    });

    it('should compute correct summary with failures', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'FAIL', error: 'Error: Invalid hook call', stack: '' },
        { storyId: 's3', status: 'FAIL', error: 'Error: Module not found', stack: '' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.total).toBe(3);
      expect(analysis.passed).toBe(1);
      expect(analysis.successRate).toBe(0.33);
      expect(analysis.uniqueErrorCount).toBe(2);
    });

    it('should count passedButEmptyRender', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS', emptyRender: true },
        { storyId: 's3', status: 'PASS', emptyRender: true },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.passedButEmptyRender).toBe(2);
      expect(analysis.successRate).toBe(1.0);
      expect(analysis.successRateWithoutEmptyRender).toBe(0.33);
    });

    it('should count passedButNoCss only when cssApplied is explicitly false', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS', cssApplied: true },
        { storyId: 's2', status: 'PASS', cssApplied: false },
        { storyId: 's3', status: 'PASS', cssApplied: false },
        { storyId: 's4', status: 'PASS' }, // probe didn't run -> not counted
        { storyId: 's5', status: 'FAIL', cssApplied: false }, // failed -> not counted
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.passedButNoCss).toBe(2);
    });

    it('should handle zero tests', () => {
      const analysis = analyzeTestResults([]);
      expect(analysis.total).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.successRateWithoutEmptyRender).toBe(0);
    });

    it('should handle PENDING tests by not counting them as passed', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PENDING' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.total).toBe(2);
      expect(analysis.passed).toBe(1);
      expect(analysis.successRate).toBe(0.5);
    });
  });
});
