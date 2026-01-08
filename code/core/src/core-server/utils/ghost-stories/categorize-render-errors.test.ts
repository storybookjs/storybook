import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractUniqueCategorizedErrors } from './categorize-render-errors';
import type { StoryTestResult } from './types';

describe('categorize-render-errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractUniqueCategorizedErrors', () => {
    it('should return empty result when there are no failed tests', () => {
      const testResults: StoryTestResult[] = [
        { storyId: 'story1', status: 'PASS' },
        { storyId: 'story2', status: 'PASS' },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(0);
      expect(result.categorizedErrors).toEqual([]);
    });

    it('should categorize unknown errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "Some completely unknown error that doesn't match any pattern",
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Unknown Error');
      expect(result.categorizedErrors[0].count).toBe(1);
    });

    it('should categorize theme provider errors from explicit error message', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `Error: ThemeProvider: Please make sure your useTheme hook is within a \`<ThemeProvider>\``,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Missing Theme Provider');
      expect(result.categorizedErrors[0].count).toBe(1);
    });

    it('should categorize missing theme provider errors from hints in the stack', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "TypeError: Cannot read properties of undefined (reading 'formBackground')",
          stack: `at /src/component/File.tsx:22:25
    at Xe (/storybook/sb-vitest/deps/styled-components.js)
    at e.generateAndInjectStyles (/storybook/sb-vitest/deps/styled-components.js)
    at /storybook/sb-vitest/deps/styled-components.js`,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Missing Theme Provider');
      expect(result.categorizedErrors[0].count).toBe(1);
      expect(result.categorizedErrors[0].matchedDependencies).toEqual(['styled-components']);
    });

    it('should categorize missing state provider errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `Error: could not find react-redux context value; please ensure the component is wrapped in a <Provider>`,
          stack: `at useReduxContext2 (/storybook/sb-vitest/deps/react-redux.js)
    at useSelector2 (/storybook/sb-vitest/deps/react-redux.js)
    at Header (/src/component/File.tsx:224:25)
 `,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Missing State Provider');
      expect(result.categorizedErrors[0].count).toBe(1);
      expect(result.categorizedErrors[0].matchedDependencies).toEqual(['react-redux']);
    });

    it('should categorize missing router provider errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `TypeError: Cannot destructure property 'basename' of 'React10.useContext(...)' as it is null.`,
          stack: `at LinkWithRef (/storybook/sb-vitest/deps/react-router-dom.js)
`,
        },
        {
          storyId: 'story2',
          status: 'FAIL',
          error: `Error: useNavigate() may be used only in the context of a <Router> component.`,
          stack: `at invariant (/storybook/sb-vitest/deps/react-router-dom.js)
    at useNavigateUnstable (/storybook/sb-vitest/deps/react-router-dom.js)
    at useNavigate (/storybook/sb-vitest/deps/react-router-dom.js)
`,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(2);
      expect(result.categorizedErrors[0].category).toBe('Missing Router Provider');
      expect(result.categorizedErrors[0].count).toBe(2);
    });

    it('should aggregate multiple different error types', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `TypeError: Cannot read properties of undefined (reading 'formBackground')`,
          stack: `at Xe (/storybook/sb-vitest/deps/styled-components.js)`,
        },
        {
          storyId: 'story2',
          status: 'FAIL',
          error: `Error: could not find react-redux context value; please ensure the component is wrapped in a <Provider>`,
          stack: `at useReduxContext2 (/storybook/sb-vitest/deps/react-redux.js)`,
        },
        {
          storyId: 'story3',
          status: 'FAIL',
          error: `Error: useNavigate() may be used only in the context of a <Router> component.`,
          stack: `at useNavigate (/storybook/sb-vitest/deps/react-router-dom.js)`,
        },
        {
          storyId: 'story4',
          status: 'FAIL',
          error: `TypeError: Cannot read properties of undefined (reading 'primary')`,
          stack: `at Xe (/storybook/sb-vitest/deps/styled-components.js)`,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(4);
      expect(result.categorizedErrors).toHaveLength(3);

      // Should be sorted by count descending
      expect(result.categorizedErrors[0].category).toBe('Missing Theme Provider');
      expect(result.categorizedErrors[0].count).toBe(2);
      expect(result.categorizedErrors[1].category).toBe('Missing State Provider');
      expect(result.categorizedErrors[1].count).toBe(1);
      expect(result.categorizedErrors[2].category).toBe('Missing Router Provider');
      expect(result.categorizedErrors[2].count).toBe(1);
    });

    it('should categorize hook usage errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `Error: Invalid hook call. Hooks can only be called inside the body of a function component.`,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Hook Usage Error');
      expect(result.categorizedErrors[0].count).toBe(1);
    });

    it('should categorize module import errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "Error: Cannot find module './non-existent-module'",
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Module Import Error');
      expect(result.categorizedErrors[0].count).toBe(1);
    });

    it('should categorize component render errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "TypeError: Cannot read property 'map' of undefined",
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Component Render Error');
      expect(result.categorizedErrors[0].count).toBe(1);
    });

    it('should truncate long error messages in examples', () => {
      const longError = 'A'.repeat(200);
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: longError,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.categorizedErrors[0].examples[0]).toHaveLength(100);
      expect(result.categorizedErrors[0].examples[0]).toBe('A'.repeat(100));
    });

    it('should ignore passing and pending tests', () => {
      const testResults: StoryTestResult[] = [
        { storyId: 'story1', status: 'PASS', error: 'Some error' },
        { storyId: 'story2', status: 'PENDING', error: 'Some error' },
        { storyId: 'story3', status: 'FAIL' }, // No error message
        {
          storyId: 'story4',
          status: 'FAIL',
          error: `TypeError: Cannot read properties of undefined (reading 'primary')`,
          stack: `at Xe (/storybook/sb-vitest/deps/styled-components.js)`,
        },
      ];

      const result = extractUniqueCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors[0].category).toBe('Missing Theme Provider');
    });

    it('should handle empty test results', () => {
      const result = extractUniqueCategorizedErrors([]);

      expect(result.totalErrors).toBe(0);
      expect(result.categorizedErrors).toEqual([]);
    });
  });
});
