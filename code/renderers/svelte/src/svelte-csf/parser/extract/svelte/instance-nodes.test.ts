import { describe, expect, it } from 'vitest';

import { extractInstanceNodes } from './instance-nodes';
import { extractModuleNodes } from './module-nodes';

import { getSvelteAST, type ESTreeAST } from '#parser/ast';

describe(extractInstanceNodes.name, () => {
  it("extract 'setTemplateCall' correctly when used", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta, setTemplate } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <script>
          setTemplate(render);
        </script>
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const instanceNodes = await extractInstanceNodes({
      instance: ast.instance,
      moduleNodes,
    });

    expect(instanceNodes).toHaveProperty('setTemplateCall');
    expect(instanceNodes.setTemplateCall).toBeDefined();
    expect(instanceNodes.setTemplateCall?.arguments).toHaveLength(1);
    expect((instanceNodes.setTemplateCall?.arguments[0] as ESTreeAST.Identifier).name).toBe(
      'render'
    );
  });

  it("extract 'setTemplateCall' correctly when NOT used", async () => {
    const ast = getSvelteAST({
      code: `
        <script module>
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
      `,
    });
    const moduleNodes = await extractModuleNodes({ module: ast.module });
    const instanceNodes = await extractInstanceNodes({
      instance: ast.instance,
      moduleNodes,
    });

    expect(instanceNodes).toHaveProperty('setTemplateCall');
    expect(instanceNodes.setTemplateCall).toBeUndefined();
  });
});
