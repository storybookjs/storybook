import { describe, expect, it } from 'vitest';

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
          storyId: "generated-story-badge",
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
          storyId: "generated-story-spinner",
          componentPath: "src/components/Spinner.tsx",
          componentName: "_Spinner"
        }));
      }"
    `);
  });

  it('generates tests for every exported component', async () => {
    const code = `
      export const Badge = () => <div />;
      export const Tag = () => <span />;
      export default () => <div />;
    `;

    const result = await transform({ code, fileName: 'src/components/Badge.tsx' });

    expect(result.code).toContain('_test("Badge", _testStory({');
    expect(result.code).toContain('_test("Tag", _testStory({');
    expect(result.code).toMatchInlineSnapshot(`
      "import { testStory as _testStory, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";
      import { test as _test, expect as _expect } from "vitest";
      export const Badge = () => <div />;
      export const Tag = () => <span />;
      const _Badge = () => <div />;
      export default _Badge;
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
          storyId: "generated-story-badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "Badge"
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
          storyId: "generated-story-tag",
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
          storyId: "generated-story-badge",
          componentPath: "src/components/Badge.tsx",
          componentName: "_Badge"
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
});
