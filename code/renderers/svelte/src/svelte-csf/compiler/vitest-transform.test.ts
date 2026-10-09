import { getStoryTitle } from 'storybook/internal/common';
import { vitestTransform } from 'storybook/internal/csf-tools';

import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { dedent } from 'ts-dedent';
import { beforeEach, describe, it, vi } from 'vitest';

import { transformStoriesCode } from './post-transform/index.ts';
import { getSvelteAST } from '../parser/ast.ts';
import { extractCompiledASTNodes } from '../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.ts';

vi.mock('storybook/internal/common', { spy: true });

beforeEach(() => {
  vi.mocked(getStoryTitle).mockReturnValue('Button');
});

const filename = 'src/Button.stories.svelte';

// The path of a `.stories.svelte` file in addon-vitest: the Svelte compiler, then Svelte CSF, then
// the Vitest transform of core.
async function transform(originalCode: string) {
  const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
  const code = new MagicString(compiledCode);

  await transformStoriesCode({
    code,
    nodes: {
      svelte: await extractSvelteASTNodes({
        ast: getSvelteAST({ code: originalCode, filename }),
        filename,
      }),
      compiled: await extractCompiledASTNodes({ ast: parseAst(compiledCode), filename }),
    },
    filename,
    originalCode,
  });

  const transformed = await vitestTransform({
    code: code.toString(),
    fileName: filename,
    configDir: '.storybook',
    stories: [],
    tagsFilter: { include: ['test'], exclude: [], skip: [] },
    previewLevelTags: [],
  });

  return typeof transformed === 'string' ? transformed : transformed.code;
}

describe('vitestTransform of a CSF factories stories file', () => {
  it('tests the stories with the meta of the file', async ({ expect }) => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story name="Primary" args={{ label: 'Primary' }} />

      <Story name="Button" args={{ label: 'Button' }} />

      <Story name="Not tested" args={{ label: 'Not tested' }} tags={['!test']} />
    `);

    expect(output).toContain('title: "Button"');
    expect(output.slice(output.indexOf('const _isRunningFromThisFile'))).toMatchInlineSnapshot(`
      "const _isRunningFromThisFile = convertToFilePath(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? _expect.getState().testPath);
      if (_isRunningFromThisFile) {
        _test("Primary", _testStory({
          exportName: "Primary",
          story: $__Primary,
          meta: $__meta,
          skipTags: [],
          storyId: "button--primary",
          componentPath: "./Button.svelte",
          componentName: "Button"
        }));
        _test("Button", _testStory({
          exportName: "Button",
          story: $__Button,
          meta: $__meta,
          skipTags: [],
          storyId: "button--button",
          componentPath: "./Button.svelte",
          componentName: "Button"
        }));
      }"
    `);
  });
});
