import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractCategorizedErrors } from './categorize-render-errors';
import type { StoryTestResult } from './types';

describe('categorize-render-errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractCategorizedErrors', () => {
    it('should return empty result when there are no failed tests', () => {
      const testResults: StoryTestResult[] = [
        { storyId: 'story1', status: 'PASS' },
        { storyId: 'story2', status: 'PASS' },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(0);
      expect(result.categorizedErrors).toEqual({});
    });

    it('should categorize unknown errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "Some completely unknown error that doesn't match any pattern",
        },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['UNKNOWN_ERROR'].description).toBe(
        'Error could not be categorized'
      );
      expect(result.categorizedErrors['UNKNOWN_ERROR'].count).toBe(1);
    });

    it('should categorize theme provider errors from explicit error message', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `Error: ThemeProvider: Please make sure your useTheme hook is within a \`<ThemeProvider>\``,
        },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].description).toBe(
        'Component attempted to access theme values without a theme provider'
      );
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].count).toBe(1);
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

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].description).toBe(
        'Component attempted to access theme values without a theme provider'
      );
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].count).toBe(1);
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].matchedDependencies).toEqual([
        'styled-components',
      ]);
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

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['MISSING_STATE_PROVIDER'].description).toBe(
        'Component attempted to access shared state without a state management provider'
      );
      expect(result.categorizedErrors['MISSING_STATE_PROVIDER'].count).toBe(1);
      expect(result.categorizedErrors['MISSING_STATE_PROVIDER'].matchedDependencies).toEqual([
        'react-redux',
      ]);
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

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(2);
      expect(result.categorizedErrors['MISSING_ROUTER_PROVIDER'].description).toBe(
        'Component attempted to access routing context without a router provider'
      );
      expect(result.categorizedErrors['MISSING_ROUTER_PROVIDER'].count).toBe(2);
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

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(4);
      expect(Object.keys(result.categorizedErrors)).toHaveLength(3);

      // Check individual error categories and their counts
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].description).toBe(
        'Component attempted to access theme values without a theme provider'
      );
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].count).toBe(2);
      expect(result.categorizedErrors['MISSING_STATE_PROVIDER'].description).toBe(
        'Component attempted to access shared state without a state management provider'
      );
      expect(result.categorizedErrors['MISSING_STATE_PROVIDER'].count).toBe(1);
      expect(result.categorizedErrors['MISSING_ROUTER_PROVIDER'].description).toBe(
        'Component attempted to access routing context without a router provider'
      );
      expect(result.categorizedErrors['MISSING_ROUTER_PROVIDER'].count).toBe(1);
    });

    it('should categorize hook usage errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: `Error: Invalid hook call. Hooks can only be called inside the body of a function component.`,
        },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['HOOK_USAGE_ERROR'].description).toBe(
        'React hook was used incorrectly'
      );
      expect(result.categorizedErrors['HOOK_USAGE_ERROR'].count).toBe(1);
    });

    it('should categorize module import errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "Error: Cannot find module './non-existent-module'",
        },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['MODULE_IMPORT_ERROR'].description).toBe(
        'A required dependency could not be resolved'
      );
      expect(result.categorizedErrors['MODULE_IMPORT_ERROR'].count).toBe(1);
    });

    it('should categorize component render errors', () => {
      const testResults: StoryTestResult[] = [
        {
          storyId: 'story1',
          status: 'FAIL',
          error: "TypeError: Cannot read property 'map' of undefined",
        },
      ];

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['COMPONENT_RENDER_ERROR'].description).toBe(
        'Component failed during render due to a runtime error'
      );
      expect(result.categorizedErrors['COMPONENT_RENDER_ERROR'].count).toBe(1);
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

      const result = extractCategorizedErrors(testResults);

      expect(result.categorizedErrors['UNKNOWN_ERROR'].examples[0]).toHaveLength(100);
      expect(result.categorizedErrors['UNKNOWN_ERROR'].examples[0]).toBe('A'.repeat(100));
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

      const result = extractCategorizedErrors(testResults);

      expect(result.totalErrors).toBe(1);
      expect(result.categorizedErrors['MISSING_THEME_PROVIDER'].description).toBe(
        'Component attempted to access theme values without a theme provider'
      );
    });

    it('should handle empty test results', () => {
      const result = extractCategorizedErrors([]);

      expect(result.totalErrors).toBe(0);
      expect(result.categorizedErrors).toEqual({});
    });
  });
});
