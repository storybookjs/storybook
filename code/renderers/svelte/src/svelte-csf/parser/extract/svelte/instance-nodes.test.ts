import { describe, expect, it } from 'vitest';

import { getSvelteAST } from '../../../parser/ast.js';
import { extractInstanceNodes } from './instance-nodes.js';
import { extractModuleNodes } from './module-nodes.js';
import type { Identifier } from 'estree';

describe(extractInstanceNodes.name, () => {
  it("extract 'setTemplateCall' correctly when used", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
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
    expect((instanceNodes.setTemplateCall?.arguments[0] as Identifier).name).toBe('render');
  });

  it("extract 'setTemplateCall' correctly when NOT used", async () => {
    const ast = getSvelteAST({
      code: `
        <script context="module">
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
