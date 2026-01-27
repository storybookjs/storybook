import { describe, expect, it, vi } from 'vitest';

import { componentTransform } from './component-transformer';

const transform = async ({
  code,
  fileName = 'src/components/Badge.tsx',
}: {
  code: string;
  fileName?: string;
}) => {
  return componentTransform({ code, fileName });
};

describe('component transformer', () => {
  it('adds a vitest test for a named component export', async () => {
    const code = `
      import { Body } from '../typography';

      export const Badge = ({ text }: { text: string }) => (
        <div>
          <Body>{text}</Body>
        </div>
      );
    `;

    const result = await transform({ code });

    expect(result.code).toContain('import { test as _test, expect as _expect } from "vitest";');
    expect(result.code).toContain('import { testStory as _testStory, convertToFilePath }');
    expect(result.code).toContain('meta: {');
    expect(result.code).toContain('component: Badge');
    expect(result.code).toContain('_test("Badge", _testStory({');

    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      import { Body } from '../typography';
      export const Badge = ({
        text
      }: {
        text: string;
      }) => <div>
                <Body>{text}</Body>
              </div>;
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Badge", _testStory({
          exportName: "Badge",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Badge",
            component: Badge
          },
          skipTags: [],
          storyId: "generated-Badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "Badge"
        }));
      }"
    `);
  });

  it('wraps a default inline component export by hoisting it to a const first', async () => {
    const code = `
      export default () => <div />;
    `;

    const result = await transform({ code, fileName: 'src/components/Spinner.tsx' });

    expect(result.code).toContain('const _Spinner = () => <div />;');
    expect(result.code).toContain('export default _Spinner;');
    expect(result.code).toContain('_test("Spinner", _testStory({');

    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      const _Spinner = () => <div />;
      export default _Spinner;
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Spinner", _testStory({
          exportName: "Spinner",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Spinner",
            component: _Spinner
          },
          skipTags: [],
          storyId: "generated-Spinner",
          componentPath: "src/components/Spinner.tsx",
          componentName: "_Spinner"
        }));
      }"
    `);
  });

  it('generates tests for wrapped exports', async () => {
    const code = `
      import { someWrapper } from '../lib/util';
      function Component() {}

      export default someWrapper(Component);

      export function withErrorBoundary<P extends object, R>(
        Component: ComponentType<P>,
      ) {
        return forwardRef<R, P>(function WithErrorBoundary(props, ref) {
          return (
            <ErrorBoundary>
              <Component {...props} ref={ref} />
            </ErrorBoundary>
          )
        })
      }
      
      export const FancyButton = React.forwardRef((props, ref) => (
        <button ref={ref}>
          {props.children}
        </button>
      ));

      export const Label = memo(() => <div />);
      
      export {
        Label,
      };
    `;

    const result = await transform({ code, fileName: 'src/components/Spinner.tsx' });

    expect(result.code).toContain('const _Spinner = someWrapper(Component);');
    expect(result.code).toContain('export default _Spinner;');
    expect(result.code).toContain('_test("Spinner", _testStory({');

    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      import { someWrapper } from '../lib/util';
      function Component() {}
      const _Spinner = someWrapper(Component);
      export default _Spinner;
      export function withErrorBoundary<P extends object, R>(Component: ComponentType<P>) {
        return forwardRef<R, P>(function WithErrorBoundary(props, ref) {
          return <ErrorBoundary>
                    <Component {...props} ref={ref} />
                  </ErrorBoundary>;
        });
      }
      export const FancyButton = React.forwardRef((props, ref) => <button ref={ref}>
                {props.children}
              </button>);
      export const Label = memo(() => <div />);
      export { Label };
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Spinner", _testStory({
          exportName: "Spinner",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Spinner",
            component: _Spinner
          },
          skipTags: [],
          storyId: "generated-Spinner",
          componentPath: "src/components/Spinner.tsx",
          componentName: "_Spinner"
        }));
        _test("withErrorBoundary", _testStory({
          exportName: "withErrorBoundary",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/withErrorBoundary",
            component: withErrorBoundary
          },
          skipTags: [],
          storyId: "generated-withErrorBoundary",
          componentPath: "src/components/Spinner.tsx",
          componentName: "withErrorBoundary"
        }));
        _test("FancyButton", _testStory({
          exportName: "FancyButton",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/FancyButton",
            component: FancyButton
          },
          skipTags: [],
          storyId: "generated-FancyButton",
          componentPath: "src/components/Spinner.tsx",
          componentName: "FancyButton"
        }));
        _test("Label", _testStory({
          exportName: "Label",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Label",
            component: Label
          },
          skipTags: [],
          storyId: "generated-Label",
          componentPath: "src/components/Spinner.tsx",
          componentName: "Label"
        }));
        _test("Label", _testStory({
          exportName: "Label",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Label",
            component: Label
          },
          skipTags: [],
          storyId: "generated-Label",
          componentPath: "src/components/Spinner.tsx",
          componentName: "Label"
        }));
      }"
    `);
  });

  it('generates tests for every exported component', async () => {
    const code = `
      export const Label = () => <div />;
      export const Tag = () => <span />;
      export default () => <div />;

      const Input = () => <input />;
      const Checkbox = () => <input type="checkbox" />;
      export {
        Input,
        Checkbox as CheckboxInput
      };
    `;

    const result = await transform({ code, fileName: 'src/components/Badge.tsx' });

    expect(result.code).toContain('_test("Badge", _testStory({');
    expect(result.code).toContain('_test("Tag", _testStory({');
    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      export const Label = () => <div />;
      export const Tag = () => <span />;
      const _Badge = () => <div />;
      export default _Badge;
      const Input = () => <input />;
      const Checkbox = () => <input type="checkbox" />;
      export { Input, Checkbox as CheckboxInput };
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Label", _testStory({
          exportName: "Label",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Label",
            component: Label
          },
          skipTags: [],
          storyId: "generated-Label",
          componentPath: "src/components/Badge.tsx",
          componentName: "Label"
        }));
        _test("Tag", _testStory({
          exportName: "Tag",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Tag",
            component: Tag
          },
          skipTags: [],
          storyId: "generated-Tag",
          componentPath: "src/components/Badge.tsx",
          componentName: "Tag"
        }));
        _test("Badge", _testStory({
          exportName: "Badge",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Badge",
            component: _Badge
          },
          skipTags: [],
          storyId: "generated-Badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "_Badge"
        }));
        _test("Input", _testStory({
          exportName: "Input",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/Input",
            component: Input
          },
          skipTags: [],
          storyId: "generated-Input",
          componentPath: "src/components/Badge.tsx",
          componentName: "Input"
        }));
        _test("CheckboxInput", _testStory({
          exportName: "CheckboxInput",
          story: {
            args: {}
          },
          meta: {
            title: "generated/tests/CheckboxInput",
            component: Checkbox
          },
          skipTags: [],
          storyId: "generated-CheckboxInput",
          componentPath: "src/components/Badge.tsx",
          componentName: "Checkbox"
        }));
      }"
    `);
  });

  it('leaves non-component exports untouched', async () => {
    const code = `
      export const VALUES = [1, 2, 3];
    `;

    const result = await transform({ code, fileName: 'src/constants.ts' });

    expect(result.code).toBe(code);
  });

  it('does not add fn import when no function placeholders exist', async () => {
    const code = `
      import { Body } from '../typography';

      export const Badge = ({ text }: { text: string }) => (
        <div>
          <Body>{text}</Body>
        </div>
      );
    `;

    const mockGetComponentArgTypes = vi.fn().mockResolvedValue({
      rating: { name: 'rating', type: { name: 'number' } },
      photoUrl: { name: 'photoUrl', type: { name: 'string', required: true } },
    });

    const result = await componentTransform({
      code,
      fileName: 'src/components/Badge.tsx',
      getComponentArgTypes: mockGetComponentArgTypes,
    });

    expect(result.code).not.toContain('import { fn as _fn } from "storybook/test"');
  });

  it('generates test with args from getComponentArgTypes', async () => {
    const code = `
      import { Body } from '../typography';

      export const Badge = ({ text }: { text: string }) => (
        <div>
          <Body>{text}</Body>
        </div>
      );
    `;

    const mockGetComponentArgTypes = vi.fn().mockResolvedValue({
      rating: { name: 'rating', type: { name: 'number' } },
      photoUrl: { name: 'photoUrl', type: { name: 'string', required: true } },
      onClick: { name: 'onClick', type: { name: 'function', required: true } },
      someObject: {
        name: 'someObject',
        type: {
          name: 'object',
          value: {
            category: { name: 'string' },
            onClick: { name: 'function' },
          },
          required: true,
        },
      },
    });

    const result = await componentTransform({
      code,
      fileName: 'src/components/Badge.tsx',
      getComponentArgTypes: mockGetComponentArgTypes,
    });

    expect(result.code).toContain('import { fn as _fn } from "storybook/test"');
    expect(result.code).toMatchInlineSnapshot(`
      "import { fn as _fn } from "storybook/test";
      import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      import { Body } from '../typography';
      export const Badge = ({
        text
      }: {
        text: string;
      }) => <div>
                <Body>{text}</Body>
              </div>;
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Badge", _testStory({
          exportName: "Badge",
          story: {
            args: {
              photoUrl: "photoUrl",
              onClick: _fn(),
              someObject: {
                category: "category",
                onClick: _fn()
              }
            }
          },
          meta: {
            title: "generated/tests/Badge",
            component: Badge
          },
          skipTags: [],
          storyId: "generated-Badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "Badge"
        }));
      }"
    `);
  });

  it('uses string literals for non-identifier object property keys', async () => {
    const code = `
      export const Badge = () => <div />;
    `;

    const mockGetComponentArgTypes = vi.fn().mockImplementation(({ componentName }) => {
      if (componentName === 'Badge') {
        return Promise.resolve({
          'data-testid': { name: 'data-testid', type: { name: 'string', required: true } },
          'aria-label': { name: 'aria-label', type: { name: 'string', required: true } },
          '2invalid': { name: '2invalid', type: { name: 'string', required: true } },
          validKey: { name: 'validKey', type: { name: 'string', required: true } },
        });
      }
      return Promise.resolve({});
    });

    const result = await componentTransform({
      code,
      fileName: 'src/components/Badge.tsx',
      getComponentArgTypes: mockGetComponentArgTypes,
    });

    // Check that the mock was called with the correct component name
    expect(mockGetComponentArgTypes).toHaveBeenCalledWith({
      componentName: 'Badge',
      fileName: 'src/components/Badge.tsx',
    });

    // Check that non-identifier keys use string literals
    expect(result.code).toContain('"data-testid": "data-testid"');
    expect(result.code).toContain('"aria-label": "aria-label"');
    expect(result.code).toContain('"2invalid": "2invalid"');
    // Check that valid identifiers still use identifier syntax
    expect(result.code).toContain('validKey: "validKey"');
    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      export const Badge = () => <div />;
      const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Badge", _testStory({
          exportName: "Badge",
          story: {
            args: {
              "data-testid": "data-testid",
              "aria-label": "aria-label",
              "2invalid": "2invalid",
              validKey: "validKey"
            }
          },
          meta: {
            title: "generated/tests/Badge",
            component: Badge
          },
          skipTags: [],
          storyId: "generated-Badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "Badge"
        }));
      }"
    `);
  });

  it('correctly handles aliased function and class exports', async () => {
    const code = `
      function MyComponent() {
        return <div />;
      }

      class MyClassComponent {
        render() {
          return <div />;
        }
      }

      export { MyComponent as RenamedComponent, MyClassComponent as RenamedClass };
    `;

    const result = await transform({ code, fileName: 'src/components/Test.tsx' });

    // Should use the exported names, not the original names
    expect(result.code).toContain('_test("RenamedComponent", _testStory({');
    expect(result.code).toContain('exportName: "RenamedComponent"');
    expect(result.code).toContain('_test("RenamedClass", _testStory({');
    expect(result.code).toContain('exportName: "RenamedClass"');
  });
});
