import { describe, expect, it } from 'vitest';

import { argCode } from 'storybook/internal/csf-tools';

import { getSvelteAST } from '../../ast.ts';
import { extractSvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { getStoryArgNodes } from './arg-nodes.ts';

const argCodeOf = async (metaArgs: string, story: string) => {
  const originalCode = `<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  const { Story } = defineMeta({ component: Button, args: ${metaArgs} });
</script>

${story}`;
  const filename = '/tmp/Button.stories.svelte';
  const nodes = await extractSvelteASTNodes({
    ast: getSvelteAST({ code: originalCode, filename }),
    filename,
  });
  const [{ component }] = nodes.storyComponents;
  return argCode(
    getStoryArgNodes({
      stories: [component],
      defineMeta: nodes.defineMetaVariableDeclaration,
      originalCode,
    })
  );
};

describe(getStoryArgNodes.name, () => {
  it('reads the meta args, overridden by the story args', async () => {
    expect(
      await argCodeOf(
        '{ onclick: fn(), size: sizes.sm }',
        `<Story name="A" args={{ onclick: handler }} />`
      )
    ).toEqual({ onclick: 'handler', size: 'sizes.sm' });
  });

  it('reads the args of the stories a story extends, under its own', async () => {
    const originalCode = `<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  const { Story } = defineMeta({ component: Button, args: { size: sizes.sm } });
</script>

<Story name="Base" args={{ onclick: handler, label: base }} />
<Story name="Extended" extend="Base" args={{ label: own }} />`;
    const filename = '/tmp/Button.stories.svelte';
    const nodes = await extractSvelteASTNodes({
      ast: getSvelteAST({ code: originalCode, filename }),
      filename,
    });
    const [base, extended] = nodes.storyComponents.map(({ component }) => component);
    expect(
      argCode(
        getStoryArgNodes({
          stories: [extended, base],
          defineMeta: nodes.defineMetaVariableDeclaration,
          originalCode,
        })
      )
    ).toEqual({ size: 'sizes.sm', onclick: 'handler', label: 'own' });
  });

  it('parses args as TypeScript without JSX', async () => {
    expect(await argCodeOf('{ value: <number>(window as any).X }', `<Story name="A" />`)).toEqual({
      value: '(window as any).X',
    });
  });

  it('leaves out every arg when the story args are not an object literal', async () => {
    expect(await argCodeOf('{ onclick: fn() }', `<Story name="A" args={storyArgs} />`)).toEqual({});
  });

  it('leaves out every arg written before a spread, a method or a computed key', async () => {
    for (const args of [
      '{ ...base, label: x }',
      '{ onclick() {}, label: x }',
      '{ [key]: h, label: x }',
    ]) {
      expect(
        await argCodeOf('{ onclick: fn() }', `<Story name="A" args={${args}} />`),
        args
      ).toEqual({ label: 'x' });
    }
  });
});
