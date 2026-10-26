import { describe, expect, it } from 'vitest';

import { getCsfFactoryTemplateForNewStoryFile } from './csf-factory-template';

describe('csf-factories', () => {
  it('should return a CSF factories template with a default import', async () => {
    const result = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'default',
      componentIsDefaultExport: true,
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import preview from '#.storybook/preview';

      import Foo from './foo';

      const meta = preview.meta({
        component: Foo,
      });

      export const Default = meta.story({});"
    `);
  });

  it('escapes the component file basename in the import specifier', async () => {
    const result = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension: `foo'; alert(1); const x = '`,
      componentExportName: 'Example',
      componentIsDefaultExport: false,
      exportedStoryName: 'Default',
    });

    expect(result).toContain(`import { Example } from './foo\\'; alert(1); const x = \\'';`);
  });
});
