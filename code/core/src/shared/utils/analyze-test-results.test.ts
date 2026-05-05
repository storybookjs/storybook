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

    it('should compute correct summary with failures', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'FAIL', error: 'Error: Invalid hook call', stack: '' },
        { storyId: 's3', status: 'FAIL', error: 'Error: Module not found', stack: '' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.runTotal).toBe(3);
      expect(analysis.runPassed).toBe(1);
      expect(analysis.runSuccessRate).toBe(0.33);
      expect(analysis.runUniqueErrorCount).toBe(2);
    });

    it('should count passedButEmptyRender', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS', emptyRender: true },
        { storyId: 's3', status: 'PASS', emptyRender: true },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.runPassedButEmptyRender).toBe(2);
      expect(analysis.runSuccessRate).toBe(1.0);
      expect(analysis.runSuccessRateWithoutEmptyRender).toBe(0.33);
    });

    it('should handle zero tests', () => {
      const analysis = analyzeTestResults([]);
      expect(analysis.runTotal).toBe(0);
      expect(analysis.runSuccessRate).toBe(0);
      expect(analysis.runSuccessRateWithoutEmptyRender).toBe(0);
      expect(analysis.cumulativeTotal).toBe(0);
    });

    it('should handle PENDING tests by not counting them as passed', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PENDING' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.runTotal).toBe(2);
      expect(analysis.runPassed).toBe(1);
      expect(analysis.runSuccessRate).toBe(0.5);
    });

    describe('cumulative stats', () => {
      it('mirrors run stats when no cumulative results are provided', () => {
        const results: StoryTestResult[] = [
          { storyId: 's1', status: 'PASS' },
          { storyId: 's2', status: 'FAIL', error: 'oops' },
        ];
        const analysis = analyzeTestResults(results);
        expect(analysis.cumulativeTotal).toBe(analysis.runTotal);
        expect(analysis.cumulativePassed).toBe(analysis.runPassed);
        expect(analysis.cumulativeSuccessRate).toBe(analysis.runSuccessRate);
        expect(analysis.cumulativeUniqueErrorCount).toBe(analysis.runUniqueErrorCount);
      });

      it('reports cumulative stats independently when provided', () => {
        const run: StoryTestResult[] = [
          { storyId: 's1', status: 'FAIL', error: 'broken' },
          { storyId: 's2', status: 'FAIL', error: 'broken' },
          { storyId: 's3', status: 'FAIL', error: 'broken' },
        ];
        const cumulative: StoryTestResult[] = [
          { storyId: 's1', status: 'PASS' },
          { storyId: 's2', status: 'PASS' },
          { storyId: 's3', status: 'FAIL', error: 'broken' },
          { storyId: 's4', status: 'PASS' },
          { storyId: 's5', status: 'PASS' },
        ];
        const analysis = analyzeTestResults(run, cumulative);
        expect(analysis.runTotal).toBe(3);
        expect(analysis.runPassed).toBe(0);
        expect(analysis.cumulativeTotal).toBe(5);
        expect(analysis.cumulativePassed).toBe(4);
        expect(analysis.cumulativeSuccessRate).toBe(0.8);
      });
    });

    describe('cssCheck', () => {
      it("is 'pass' when a --css-check story passed", () => {
        const results: StoryTestResult[] = [
          { storyId: 'components-button--primary', status: 'PASS' },
          { storyId: 'components-button--css-check', status: 'PASS' },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('pass');
      });

      it("is 'fail' when a --css-check story failed", () => {
        const results: StoryTestResult[] = [
          {
            storyId: 'components-button--css-check',
            status: 'FAIL',
            error: 'expected rgb(37, 99, 235) but got rgba(0, 0, 0, 0)',
          },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('fail');
      });

      it("is 'not-run' when no --css-check story is present", () => {
        const results: StoryTestResult[] = [
          { storyId: 'components-button--primary', status: 'PASS' },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('not-run');
      });

      it("is 'not-run' when the --css-check story was skipped / pending / todo", () => {
        // PENDING covers any non-pass / non-fail Vitest status (skipped,
        // pending, todo, filtered out). No pass/fail signal available →
        // 'not-run', same bucket as "story wasn't authored at all".
        const results: StoryTestResult[] = [
          { storyId: 'components-button--css-check', status: 'PENDING' },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('not-run');
      });

      it("is 'not-run' for an empty result list", () => {
        expect(analyzeTestResults([]).runCssCheck).toBe('not-run');
      });

      it('uses the first match when multiple --css-check stories exist', () => {
        // Prompt violation: the AI setup prompt asks for exactly one.
        // First match wins; downstream aggregates still reflect all of them.
        const results: StoryTestResult[] = [
          { storyId: 'components-button--css-check', status: 'PASS' },
          { storyId: 'components-card--css-check', status: 'FAIL', error: 'style mismatch' },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('pass');
      });

      it('is case-insensitive on the suffix (defensive)', () => {
        // CSF already lowercases storyIds. This keeps the check resilient
        // to a future upstream change in sanitization.
        const results: StoryTestResult[] = [
          { storyId: 'components-button--CSS-CHECK', status: 'PASS' },
        ];
        expect(analyzeTestResults(results).runCssCheck).toBe('pass');
      });
    });
  });
});
