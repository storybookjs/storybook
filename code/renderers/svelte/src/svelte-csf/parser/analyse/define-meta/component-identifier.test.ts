import { describe, expect, it } from 'vitest';

import { getSvelteAST } from '../../ast.ts';
import { extractSvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { InvalidComponentValueError } from '../../../utils/error/parser/analyse/define-meta.ts';
import { getDefineMetaComponentValue } from './component-identifier.ts';

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
