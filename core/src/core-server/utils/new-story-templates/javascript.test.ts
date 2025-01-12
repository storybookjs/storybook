import { describe, expect, it } from 'vitest';

import { getJavaScriptTemplateForNewStoryFile } from './javascript';

describe('javascript', () => {
  it('should return a TypeScript template with a default import', async () => {
    const result = await getJavaScriptTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'default',
      componentIsDefaultExport: true,
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import Foo from './foo';

      const meta = {
        component: Foo,
      };
      
      export default meta;
      
      export const Default = {};"
    `);
  });

  it('should return a TypeScript template with a named import', async () => {
    const result = await getJavaScriptTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'Example',
      componentIsDefaultExport: false,
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import { Example } from './foo';

      const meta = {
        component: Example,
      };

      export default meta;

      export const Default = {};"
    `);
  });
});
