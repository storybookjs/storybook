import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_CATEGORIES, categorizeError } from './categorize-render-errors';

describe('categorize-render-errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('categorizeError', () => {
    describe('Category specific logic', () => {
      describe('MODULE_IMPORT_ERROR', () => {
        it('should categorize all module import errors', () => {
          expect(categorizeError('Cannot find module "react"').category).toBe(
            ERROR_CATEGORIES.MODULE_IMPORT_ERROR
          );

          expect(
            categorizeError("Module not found: Error: Can't resolve './components/Button'").category
          ).toBe(ERROR_CATEGORIES.MODULE_IMPORT_ERROR);

          expect(categorizeError("Cannot resolve module 'fs' in path/to/file.js").category).toBe(
            ERROR_CATEGORIES.MODULE_IMPORT_ERROR
          );
        });
      });

      describe('TEST_FILE_IMPORT_ERROR', () => {
        it('should categorize test file import errors', () => {
          expect(
            categorizeError(
              'Failed to import test file /foo/node_modules/@storybook/addon-vitest/dist/vitest-plugin/setup-file.js'
            ).category
          ).toBe(ERROR_CATEGORIES.TEST_FILE_IMPORT_ERROR);

          expect(
            categorizeError('Failed to import test file /path/to/test/setup.ts').category
          ).toBe(ERROR_CATEGORIES.TEST_FILE_IMPORT_ERROR);
        });
      });

      describe('DYNAMIC_MODULE_IMPORT_ERROR', () => {
        it('should categorize dynamic module import errors', () => {
          expect(
            categorizeError(
              'TypeError: Failed to fetch dynamically imported module: http://localhost:63315/node_modules/.cache/storybook/2523d14eb1a348695c30002850a8852e9305e60b397e9b529978c17a0d2cd524/sb-vitest/deps/react-18-PYSEDAWB-3KPRILU2.js?v=6f767e0c'
            ).category
          ).toBe(ERROR_CATEGORIES.DYNAMIC_MODULE_IMPORT_ERROR);

          expect(categorizeError('Failed to fetch dynamically imported module').category).toBe(
            ERROR_CATEGORIES.DYNAMIC_MODULE_IMPORT_ERROR
          );
        });
      });

      describe('HOOK_USAGE_ERROR', () => {
        it('should categorize all hook usage errors appropriately', () => {
          expect(
            categorizeError(
              'Invalid hook call. Hooks can only be called inside the body of a function component.'
            ).category
          ).toBe(ERROR_CATEGORIES.HOOK_USAGE_ERROR);

          expect(
            categorizeError('Rendered more hooks than during the previous render.').category
          ).toBe(ERROR_CATEGORIES.HOOK_USAGE_ERROR);

          expect(
            categorizeError('Hooks can only be called inside React function components.').category
          ).toBe(ERROR_CATEGORIES.HOOK_USAGE_ERROR);
        });
      });

      describe('MISSING_STATE_PROVIDER', () => {
        it('should categorize state management errors from stack context messages', () => {
          const stack = `
          at useSelector2 (http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/redux.js:1015:26)
          at Component (http://localhost/Component.tsx:10:5)
        `;

          // error message is not useful alone, but combining with stack it will be
          const result = categorizeError('Cannot read properties of undefined', stack);

          expect(result.category).toBe(ERROR_CATEGORIES.MISSING_STATE_PROVIDER);
          expect(result.matchedDependencies).toEqual(['redux']);
        });

        it('should not categorize if there are no state management packages in stack', () => {
          const result = categorizeError("Cannot read properties of undefined (reading 'state')");

          expect(result.category).not.toBe(ERROR_CATEGORIES.MISSING_STATE_PROVIDER);
        });
      });

      describe('MISSING_ROUTER_PROVIDER', () => {
        it('should categorize router context errors', () => {
          const stack = `
          at useLocation (http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/react-router-dom.js:5431:3)
          at Component (http://localhost/Component.tsx:15:20)
        `;

          const result = categorizeError(
            'useLocation() may be used only in the context of a <Router> component.',
            stack
          );

          expect(result.category).toBe(ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER);
          expect(result.matchedDependencies).toEqual(['react-router-dom']);
        });

        it('should categorize router errors by message content', () => {
          expect(
            categorizeError(
              'useNavigate() may be used only in the context of a <Router> component.'
            ).category
          ).toBe(ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER);

          expect(categorizeError('Router context not found').category).toBe(
            ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER
          );
        });
      });

      describe('MISSING_THEME_PROVIDER', () => {
        it('should categorize theme error from message', () => {
          expect(
            categorizeError(
              'ThemeProvider: Please make sure your useTheme hook is within a `<ThemeProvider>`'
            ).category
          ).toBe(ERROR_CATEGORIES.MISSING_THEME_PROVIDER);

          expect(categorizeError('useTheme must be used within a ThemeProvider').category).toBe(
            ERROR_CATEGORIES.MISSING_THEME_PROVIDER
          );

          expect(categorizeError('theme provider not found').category).toBe(
            ERROR_CATEGORIES.MISSING_THEME_PROVIDER
          );
        });

        it('should categorize theme context errors with hint from stack', () => {
          const stack = `
          at http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/styled-components.js:1168:14
          at Component (http://localhost/Component.tsx:13:25)
        `;

          const result = categorizeError(
            "Cannot read properties of undefined (reading 'theme')",
            stack
          );

          expect(result.category).toBe(ERROR_CATEGORIES.MISSING_THEME_PROVIDER);
          expect(result.matchedDependencies).toEqual(['styled-components']);
        });
      });

      describe('MISSING_TRANSLATION_PROVIDER', () => {
        it('should categorize translation errors by message only', () => {
          const result = categorizeError('Translation provider missing');

          expect(result.category).toBe(ERROR_CATEGORIES.MISSING_TRANSLATION_PROVIDER);
        });

        it('should categorize i18n context errors with hint from stack', () => {
          const stack = `
          at http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/react-i18next.js:5431:3
          at Component (http://localhost/Component.tsx:15:20)
        `;

          const result = categorizeError('i18n context not found', stack);

          expect(result.category).toBe(ERROR_CATEGORIES.MISSING_TRANSLATION_PROVIDER);
          expect(result.matchedDependencies).toEqual(['react-i18next']);
        });
      });

      describe('MISSING_PORTAL_ROOT', () => {
        it('should categorize portal container errors', () => {
          expect(categorizeError('Portal container is null').category).toBe(
            ERROR_CATEGORIES.MISSING_PORTAL_ROOT
          );

          expect(categorizeError('Portal root not found').category).toBe(
            ERROR_CATEGORIES.MISSING_PORTAL_ROOT
          );
        });
      });

      describe('MISSING_PROVIDER', () => {
        it('should categorize useContext null errors', () => {
          expect(categorizeError('useContext returned null or undefined').category).toBe(
            ERROR_CATEGORIES.MISSING_PROVIDER
          );
        });
      });

      describe('SERVER_COMPONENTS_ERROR', () => {
        it('should categorize render-related errors', () => {
          expect(
            categorizeError(
              'Error: async/await is not yet supported in Client Components, only Server Components.'
            ).category
          ).toBe(ERROR_CATEGORIES.SERVER_COMPONENTS_ERROR);

          expect(
            categorizeError(
              "This error is often caused by accidentally adding `'use client'` to a module that was originally written for the server"
            ).category
          ).toBe(ERROR_CATEGORIES.SERVER_COMPONENTS_ERROR);
        });
      });

      describe('COMPONENT_RENDER_ERROR', () => {
        it('should categorize render-related errors', () => {
          expect(categorizeError('undefined is not a function').category).toBe(
            ERROR_CATEGORIES.COMPONENT_RENDER_ERROR
          );

          expect(categorizeError('Cannot read properties of undefined').category).toBe(
            ERROR_CATEGORIES.COMPONENT_RENDER_ERROR
          );

          expect(categorizeError('Failed to render component').category).toBe(
            ERROR_CATEGORIES.COMPONENT_RENDER_ERROR
          );
        });
      });

      describe('UNKNOWN_ERROR', () => {
        it('should categorize unmatched errors as unknown', () => {
          const result = categorizeError('Some random error that does not match any category');

          expect(result.category).toBe(ERROR_CATEGORIES.UNKNOWN_ERROR);
        });
      });
    });

    describe('priority ordering', () => {
      it('should categorize based on priority', () => {
        const moduleImportError = 'Cannot find module and cannot read properties of undefined';

        const componentRenderError = 'Cannot read properties of undefined';

        // should return each error in their own category
        expect(categorizeError(moduleImportError).category).toBe(
          ERROR_CATEGORIES.MODULE_IMPORT_ERROR
        );
        expect(categorizeError(componentRenderError).category).toBe(
          ERROR_CATEGORIES.COMPONENT_RENDER_ERROR
        );

        // but when combined should take highest priority category
        expect(categorizeError(moduleImportError + ' ' + componentRenderError).category).toBe(
          ERROR_CATEGORIES.MODULE_IMPORT_ERROR
        );
      });
    });

    describe('stack trace dependency extraction', () => {
      it('should extract dependencies from stack traces with /deps/ pattern', () => {
        const stack = `
          at http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/styled-components.js:1168:14
          at http://localhost:63315/node_modules/.cache/storybook/490ab5/sb-vitest/deps/@emotion/react.js:500:10
          at Component.tsx:13:25
        `;

        const result = categorizeError(
          "Cannot read properties of undefined (reading 'theme')",
          stack
        );

        expect(result.matchedDependencies).toEqual(['styled-components', '@emotion/react']);
      });
    });
  });
});
