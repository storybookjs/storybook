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

  it('should return a CSF factories template with a named import', async () => {
    const result = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'FooComponent',
      componentIsDefaultExport: false,
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import preview from '#.storybook/preview';

      import { FooComponent } from './foo';

      const meta = preview.meta({
        component: FooComponent,
        
      });

      export const Default = meta.story({});"
    `);
  });

  it('should return a CSF factories template with a custom preview import path', async () => {
    const result = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'default',
      componentIsDefaultExport: true,
      exportedStoryName: 'Default',
      previewImportPath: '../../.storybook/preview',
    });

    expect(result).toMatchInlineSnapshot(`
      "import preview from '../../.storybook/preview';

      import Foo from './foo';

      const meta = preview.meta({
        component: Foo,
        
      });

      export const Default = meta.story({});"
    `);
  });
});
