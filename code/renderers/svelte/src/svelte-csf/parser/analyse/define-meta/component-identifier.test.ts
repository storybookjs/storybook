import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolve } from 'pathe';

import { getSvelteAST } from '../../ast.ts';
import { extractSvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { InvalidComponentValueError } from '../../../utils/error/parser/analyse/define-meta.ts';
import { getDefineMetaComponentValue } from './component-identifier.ts';
import { getDefineMetaRenderValue } from './render-identifier.ts';
import { GetDefineMetaFirstArgumentError } from '../../../utils/error/parser/extract/svelte.ts';

const getComponentValue = async (component: string) => {
  const code = `
    <script module>
      import { defineMeta } from "@storybook/svelte";

      const { Story } = defineMeta({
        component: ${component},
      });
    </script>

    <Story name="Default" />
  `;
  const ast = getSvelteAST({ code });
  const nodes = await extractSvelteASTNodes({ ast });
  return getDefineMetaComponentValue({ nodes });
};

describe(getDefineMetaComponentValue.name, () => {
  it('accepts a plain identifier', async () => {
    const value = await getComponentValue('SampleComponent');

    expect(value).toMatchObject({ type: 'Identifier', name: 'SampleComponent' });
  });

  it('accepts a non-computed member expression', async () => {
    const value = await getComponentValue('Input.Select');

    expect(value).toMatchObject({
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'Input' },
      property: { type: 'Identifier', name: 'Select' },
    });
  });

  it.each([
    ['a computed member expression', "Input['Select']"],
    ['a member expression chain', 'Input.Group.Item'],
    ['a member expression on this', 'this.input'],
  ])('rejects %s', async (_, component) => {
    await expect(getComponentValue(component)).rejects.toThrow(InvalidComponentValueError);
  });
});

describe('the first argument of defineMeta', () => {
  it.each([
    ['component', getDefineMetaComponentValue],
    ['render', getDefineMetaRenderValue],
  ])('names the stories file when %s is read from a non-object argument', async (_, read) => {
    const filename = resolve('/project/src/Button.stories.svelte');
    const code = `
      <script module>
        import { defineMeta } from "@storybook/svelte";

        const meta = { title: 'Button' };
        const { Story } = defineMeta(meta);
      </script>

      <Story name="Default" />
    `;
    const nodes = await extractSvelteASTNodes({ ast: getSvelteAST({ code, filename }), filename });

    expect(() => read({ nodes, filename })).toThrow(GetDefineMetaFirstArgumentError);
    expect(() => read({ nodes, filename })).toThrow(pathToFileURL(filename).href);
  });
});
