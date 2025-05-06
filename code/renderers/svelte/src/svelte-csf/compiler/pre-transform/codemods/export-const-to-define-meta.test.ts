import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { print } from 'svelte-ast-print';
import { describe, it } from 'vitest';

import { transformExportMetaToDefineMeta } from './export-const-to-define-meta.js';

import type { ESTreeAST } from '$lib/parser/ast.js';
import { parseAndExtractSvelteNode } from '../../../../tests/extractor.js';

describe(transformExportMetaToDefineMeta.name, () => {
  it('works with advanced example', async ({ expect }) => {
    const code = `
      <script context="module" lang="ts">
        import { Story, Template } from "${pkg.name}";

        export const meta = {
          component: Button,
          tags: ['autodocs'],
          args: {
            children: 'Click me',
            onclick: onclickFn,
          },
          argTypes: {
            backgroundColor: { control: 'color' },
            size: {
              control: { type: 'select' },
              options: ['small', 'medium', 'large'],
            },
            children: { control: 'text' },
          }
        } satisfies Meta<Button>;
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ESTreeAST.ExportNamedDeclaration>(
      code,
      'ExportNamedDeclaration'
    );

    expect(print(transformExportMetaToDefineMeta(node))).toMatchInlineSnapshot(`
			"const { Story } = defineMeta({
				component: Button,
				tags: ['autodocs'],
				args: { children: 'Click me', onclick: onclickFn },
				argTypes: {
					backgroundColor: { control: 'color' },
					size: {
						control: { type: 'select' },
						options: ['small', 'medium', 'large']
					},
					children: { control: 'text' }
				}
			});"
		`);
  });

  it('leading comments are included', async ({ expect }) => {
    const code = `
      <script context="module">
        import { Story, Template } from "${pkg.name}";

        /**
         * This is a description for the **Button** component stories.
         */
        export const meta = {
          component: Button,
        };
      </script>
    `;
    const node = await parseAndExtractSvelteNode<ESTreeAST.ExportNamedDeclaration>(
      code,
      'ExportNamedDeclaration'
    );

    expect(print(transformExportMetaToDefineMeta(node))).toMatchInlineSnapshot(`
			"/**
			 * This is a description for the **Button** component stories.
			 */
			const { Story } = defineMeta({ component: Button });"
		`);
  });
});
