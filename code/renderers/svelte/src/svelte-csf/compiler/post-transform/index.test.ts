import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { SVELTE_CSF_RENDERER_IMPORT_SOURCE } from '../../constants.ts';
import { dedent } from 'ts-dedent';
import MagicString from 'magic-string';
import { parseAst } from 'rollup/parseAst';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { transformStoriesCode } from './index.ts';

import { getSvelteAST } from '../../parser/ast.ts';
import { extractSvelteASTNodes } from '../../parser/extract/svelte/nodes.ts';
import { extractCompiledASTNodes } from '../../parser/extract/compiled/nodes.ts';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe(transformStoriesCode.name, () => {
  it('transformed code matches inlined snapshot', async () => {
    const filename = path.resolve(__dirname, '../../../__test__/svelte-csf/example.stories.svelte');
    const originalCode = fs.readFileSync(filename).toString();
    const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
    const svelteAST = getSvelteAST({ code: originalCode, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledCode),
      filename,
    });
    const code = new MagicString(compiledCode);

    await transformStoriesCode({
      code,
      nodes: {
        svelte: svelteASTNodes,
        compiled: compiledASTNodes,
      },
      filename,
      originalCode,
    });

    const output = code.toString();

    expect(output.slice(output.indexOf('import { createRuntimeStories }'))).toMatchInlineSnapshot(`
      "import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Example_stories, $__meta);

      export default $__meta;

      export const __namedExportsOrder = [
      	'Default',
      	'Rounded',
      	'Square',
      	'AsChild',
      	'ChildrenForwared'
      ];

      const $__Default = { ...$__stories['Default'], tags: ['svelte-csf-v5'] };
      const $__Rounded = { ...$__stories['Rounded'], tags: ['svelte-csf-v5'] };
      const $__Square = { ...$__stories['Square'], tags: ['svelte-csf-v5'] };
      const $__AsChild = { ...$__stories['AsChild'], tags: ['svelte-csf-v5'] };
      const $__ChildrenForwared = { ...$__stories['ChildrenForwared'], tags: ['svelte-csf-v5'] };

      export {
      	$__Default as Default,
      	$__Rounded as Rounded,
      	$__Square as Square,
      	$__AsChild as AsChild,
      	$__ChildrenForwared as ChildrenForwared
      };"
    `);
  });

  it('works with empty object and array literals', async () => {
    const filename = 'Empty.stories.svelte';
    const originalCode = dedent`
      <script module>
        import { defineMeta } from "${SVELTE_CSF_RENDERER_IMPORT_SOURCE}";

        /** Description of the component */
        const { Story } = defineMeta({});
      </script>

      <!-- Description of the story -->
      <Story name="Default" parameters={{}} tags={[]} />
    `;
    const compiledCode = compile(originalCode, { filename, dev: true }).js.code;
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: getSvelteAST({ code: originalCode, filename }),
      filename,
    });
    // NOTE: Rollup's parser returns frozen arrays for empty object and array literals
    const compiledASTNodes = await extractCompiledASTNodes({
      ast: parseAst(compiledCode),
      filename,
    });
    const code = new MagicString(compiledCode);

    await transformStoriesCode({
      code,
      nodes: {
        svelte: svelteASTNodes,
        compiled: compiledASTNodes,
      },
      filename,
      originalCode,
    });

    const output = code.toString();

    expect(output).toContain("component: 'Description of the component'");
    expect(output).toContain("story: 'Description of the story'");
    expect(output).toContain('__svelteCsf');
  });
});

describe('CSF factories', () => {
  async function transform(originalCode: string) {
    const filename = 'Button.stories.svelte';
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

    return code.toString();
  }

  it('names the meta and creates the stories with meta.story()', async () => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        /** Description of the component */
        const { Story } = preview.meta({ component: Button, args: { primary: true } });
      </script>

      <!-- Description of the story -->
      <Story name="Primary" args={{ label: 'Primary' }} tags={['autodocs']} />

      <Story name="Button">
        {#snippet template(args)}
          <Button {...args} />
        {/snippet}
      </Story>
    `);

    expect(output).toMatchInlineSnapshot(`
      "import 'svelte/internal/disclose-version';
      import 'svelte/internal/flags/legacy';

      Button_stories[$.FILENAME] = 'Button.stories.svelte';

      import preview from '#.storybook/preview';
      import Button from './Button.svelte';
      import * as $ from 'svelte/internal/client';

      const $__meta = preview.meta({
      	component: Button,
      	args: { primary: true },
      	parameters: {
      		docs: { description: { component: 'Description of the component' } }
      	}
      });
      const { Story } = $__meta;
      var root = $.add_locations($.from_html(\`<!> <!>\`, 1), Button_stories[$.FILENAME], []);

      function Button_stories($$anchor, $$props) {
      	$.check_target(new.target);
      	$.push($$props, false, Button_stories);

      	var $$exports = { ...$.legacy_api() };

      	$.init();

      	var fragment = root();
      	var node = $.first_child(fragment);

      	$.add_svelte_meta(
      		() => Story(node, {
      			name: 'Primary',
      			args: { label: 'Primary' },
      			tags: ['autodocs'],
      			parameters: {
      				docs: { description: { story: 'Description of the story' } },
      				__svelteCsf: { rawCode: '<Button {...args} />' }
      			}
      		}),
      		'component',
      		Button_stories,
      		10,
      		0,
      		{ componentTag: 'Story' }
      	);

      	var node_1 = $.sibling(node, 2);

      	{
      		const template = $.wrap_snippet(Button_stories, function ($$anchor, args = $.noop) {
      			$.validate_snippet_args(...arguments);
      			$.add_svelte_meta(() => Button($$anchor, $.spread_props(args)), 'component', Button_stories, 14, 4, { componentTag: 'Button' });
      		});

      		$.add_svelte_meta(
      			() => Story(node_1, {
      				name: 'Button',
      				template,
      				$$slots: { template: true },
      				parameters: { __svelteCsf: { rawCode: '<Button {...args} />' } }
      			}),
      			'component',
      			Button_stories,
      			12,
      			0,
      			{ componentTag: 'Story' }
      		);
      	}

      	$.append($$anchor, fragment);

      	return $.pop($$exports);
      }
      import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Button_stories, $__meta.input);

      export const __namedExportsOrder = ['Primary', 'Button'];

      const $__Primary = $__meta.story({
      	...$__stories['Primary'],
      	tags: ['autodocs', 'svelte-csf-v5']
      });

      const $__Button = $__meta.story({ ...$__stories['Button'], tags: ['svelte-csf-v5'] });

      export { $__Primary as Primary, $__Button as Button };"
    `);
  });

  it('names the meta from preview.type<>().meta()', async () => {
    const output = await transform(dedent`
      <script module lang="ts">
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.type<{ args: { theme: string } }>().meta({ component: Button });
      </script>

      <Story name="Primary" args={{ label: 'Primary', theme: 'dark' }} />
    `);

    expect(output).toMatchInlineSnapshot(`
      "import 'svelte/internal/disclose-version';
      import 'svelte/internal/flags/legacy';

      Button_stories[$.FILENAME] = 'Button.stories.svelte';

      import preview from '#.storybook/preview';
      import Button from './Button.svelte';
      import * as $ from 'svelte/internal/client';

      const $__meta = preview.type().meta({ component: Button });
      const { Story } = $__meta;

      function Button_stories($$anchor, $$props) {
      	$.check_target(new.target);
      	$.push($$props, false, Button_stories);

      	var $$exports = { ...$.legacy_api() };

      	$.init();

      	$.add_svelte_meta(
      		() => Story($$anchor, {
      			name: 'Primary',
      			args: { label: 'Primary', theme: 'dark' },
      			parameters: { __svelteCsf: { rawCode: '<Button {...args} />' } }
      		}),
      		'component',
      		Button_stories,
      		8,
      		0,
      		{ componentTag: 'Story' }
      	);

      	return $.pop($$exports);
      }
      import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Button_stories, $__meta.input);

      export const __namedExportsOrder = ['Primary'];

      const $__Primary = $__meta.story({ ...$__stories['Primary'], tags: ['svelte-csf-v5'] });

      export { $__Primary as Primary };"
    `);
  });

  it('names the meta from preview.meta().type<>()', async () => {
    const output = await transform(dedent`
      <script module lang="ts">
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button }).type<{ args: { theme: string } }>();
      </script>

      <Story name="Primary" args={{ label: 'Primary', theme: 'dark' }} />
    `);

    expect(output).toMatchInlineSnapshot(`
      "import 'svelte/internal/disclose-version';
      import 'svelte/internal/flags/legacy';

      Button_stories[$.FILENAME] = 'Button.stories.svelte';

      import preview from '#.storybook/preview';
      import Button from './Button.svelte';
      import * as $ from 'svelte/internal/client';

      const $__meta = preview.meta({ component: Button }).type();
      const { Story } = $__meta;

      function Button_stories($$anchor, $$props) {
      	$.check_target(new.target);
      	$.push($$props, false, Button_stories);

      	var $$exports = { ...$.legacy_api() };

      	$.init();

      	$.add_svelte_meta(
      		() => Story($$anchor, {
      			name: 'Primary',
      			args: { label: 'Primary', theme: 'dark' },
      			parameters: { __svelteCsf: { rawCode: '<Button {...args} />' } }
      		}),
      		'component',
      		Button_stories,
      		8,
      		0,
      		{ componentTag: 'Story' }
      	);

      	return $.pop($$exports);
      }
      import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Button_stories, $__meta.input);

      export const __namedExportsOrder = ['Primary'];

      const $__Primary = $__meta.story({ ...$__stories['Primary'], tags: ['svelte-csf-v5'] });

      export { $__Primary as Primary };"
    `);
  });

  it('creates the stories of the Story components from meta.type<>()', async () => {
    const output = await transform(dedent`
      <script module lang="ts">
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const meta = preview.meta({ component: Button });
        const { Story } = meta;
        const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
      </script>

      <Story name="Primary" args={{ label: 'Primary' }} />

      <IconStory name="Icon" args={{ label: 'Icon', icon: 'star' }}>
        {#snippet template({ icon, ...args })}
          <Button {...args} label={icon} />
        {/snippet}
      </IconStory>
    `);

    expect(output).toMatchInlineSnapshot(`
      "import 'svelte/internal/disclose-version';
      import 'svelte/internal/flags/legacy';

      Button_stories[$.FILENAME] = 'Button.stories.svelte';

      import preview from '#.storybook/preview';
      import Button from './Button.svelte';
      import * as $ from 'svelte/internal/client';

      const meta = preview.meta({ component: Button });
      const { Story } = meta;
      const { Story: IconStory } = meta.type();
      var root = $.add_locations($.from_html(\`<!> <!>\`, 1), Button_stories[$.FILENAME], []);

      function Button_stories($$anchor, $$props) {
      	$.check_target(new.target);
      	$.push($$props, false, Button_stories);

      	var $$exports = { ...$.legacy_api() };

      	$.init();

      	var fragment = root();
      	var node = $.first_child(fragment);

      	$.add_svelte_meta(
      		() => Story(node, {
      			name: 'Primary',
      			args: { label: 'Primary' },
      			parameters: { __svelteCsf: { rawCode: '<Button {...args} />' } }
      		}),
      		'component',
      		Button_stories,
      		10,
      		0,
      		{ componentTag: 'Story' }
      	);

      	var node_1 = $.sibling(node, 2);

      	{
      		const template = $.wrap_snippet(Button_stories, function ($$anchor, $$arg0) {
      			$.validate_snippet_args(...arguments);

      			let icon = () => ($$arg0?.()).icon;

      			icon();

      			let args = () => $.exclude_from_object($$arg0?.(), ['icon']);

      			args();

      			$.add_svelte_meta(
      				() => Button($$anchor, $.spread_props(args, {
      					get label() {
      						return icon();
      					}
      				})),
      				'component',
      				Button_stories,
      				14,
      				4,
      				{ componentTag: 'Button' }
      			);
      		});

      		$.add_svelte_meta(
      			() => IconStory(node_1, {
      				name: 'Icon',
      				args: { label: 'Icon', icon: 'star' },
      				template,
      				$$slots: { template: true },
      				parameters: {
      					__svelteCsf: { rawCode: '<Button {...args} label={icon} />' }
      				}
      			}),
      			'component',
      			Button_stories,
      			12,
      			0,
      			{ componentTag: 'IconStory' }
      		);
      	}

      	$.append($$anchor, fragment);

      	return $.pop($$exports);
      }
      import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Button_stories, meta.input);

      export const __namedExportsOrder = ['Primary', 'Icon'];

      const $__Primary = meta.story({ ...$__stories['Primary'], tags: ['svelte-csf-v5'] });
      const $__Icon = meta.story({ ...$__stories['Icon'], tags: ['svelte-csf-v5'] });

      export { $__Primary as Primary, $__Icon as Icon };"
    `);
  });

  it('declares each story after the story it extends, and keeps the file order', async () => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story extend="Primary" name="Primary Small" args={{ size: 'small' }} />

      <Story name="Primary" args={{ primary: true }}>Click me</Story>

      <Story extend="Primary Small" name="Primary Small Starred" tags={['starred']}>
        {#snippet template(args)}
          <Button {...args}>★</Button>
        {/snippet}
      </Story>

      <Story extend="Primary" name="Primary Static" asChild />
    `);

    expect(output.match(/rawCode: '.*'/g)).toMatchInlineSnapshot(`
      [
        "rawCode: '<Button {...args}>\\n  Click me\\n</Button>'",
        "rawCode: '<Button {...args}>\\n  Click me\\n</Button>'",
        "rawCode: '<Button {...args}>★</Button>'",
        "rawCode: 'Click me'",
      ]
    `);
    expect(output.slice(output.indexOf('const $__stories'))).toMatchInlineSnapshot(`
      "const $__stories = createRuntimeStories(Button_stories, $__meta.input);

      export const __namedExportsOrder = [
      	'PrimarySmall',
      	'Primary',
      	'PrimarySmallStarred',
      	'PrimaryStatic'
      ];

      const $__Primary = $__meta.story({ ...$__stories['Primary'], tags: ['svelte-csf-v5'] });
      const $__PrimarySmall = $__Primary.extend({ ...$__stories['PrimarySmall'], tags: ['svelte-csf-v5'] });

      const $__PrimarySmallStarred = $__PrimarySmall.extend({
      	...$__stories['PrimarySmallStarred'],
      	tags: ['starred', 'svelte-csf-v5']
      });

      const $__PrimaryStatic = $__Primary.extend({ ...$__stories['PrimaryStatic'], tags: ['svelte-csf-v5'] });

      export {
      	$__PrimarySmall as PrimarySmall,
      	$__Primary as Primary,
      	$__PrimarySmallStarred as PrimarySmallStarred,
      	$__PrimaryStatic as PrimaryStatic
      };"
    `);
  });

  it('renders the content of the parent for a story whose children are only whitespace or a comment', async () => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const { Story } = preview.meta({ component: Button });
      </script>

      <Story name="Primary">Click me</Story>

      <Story extend="Primary" name="Spaces">
      </Story>

      <Story extend="Primary" name="Comment"><!-- A note --></Story>
    `);

    expect(output.match(/rawCode: '.*'/g)).toEqual(
      Array(3).fill(String.raw`rawCode: '<Button {...args}>\n  Click me\n</Button>'`)
    );
  });

  it('uses the meta variable of the file', async () => {
    const output = await transform(dedent`
      <script module>
        import preview from '#.storybook/preview';
        import Button from './Button.svelte';

        const meta = preview.meta({ component: Button });
        const { Story } = meta;
      </script>

      <Story name="Primary" args={{ label: 'Primary' }} />
    `);

    expect(output).toMatchInlineSnapshot(`
      "import 'svelte/internal/disclose-version';
      import 'svelte/internal/flags/legacy';

      Button_stories[$.FILENAME] = 'Button.stories.svelte';

      import preview from '#.storybook/preview';
      import Button from './Button.svelte';
      import * as $ from 'svelte/internal/client';

      const meta = preview.meta({ component: Button });
      const { Story } = meta;

      function Button_stories($$anchor, $$props) {
      	$.check_target(new.target);
      	$.push($$props, false, Button_stories);

      	var $$exports = { ...$.legacy_api() };

      	$.init();

      	$.add_svelte_meta(
      		() => Story($$anchor, {
      			name: 'Primary',
      			args: { label: 'Primary' },
      			parameters: { __svelteCsf: { rawCode: '<Button {...args} />' } }
      		}),
      		'component',
      		Button_stories,
      		9,
      		0,
      		{ componentTag: 'Story' }
      	);

      	return $.pop($$exports);
      }
      import { createRuntimeStories } from '@storybook/svelte/internal/svelte-csf/create-runtime-stories';

      const $__stories = createRuntimeStories(Button_stories, meta.input);

      export const __namedExportsOrder = ['Primary'];

      const $__Primary = meta.story({ ...$__stories['Primary'], tags: ['svelte-csf-v5'] });

      export { $__Primary as Primary };"
    `);
  });
});
