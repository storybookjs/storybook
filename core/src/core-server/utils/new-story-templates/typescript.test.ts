import { describe, expect, it } from 'vitest';

import { getTypeScriptTemplateForNewStoryFile } from './typescript';

describe('typescript', () => {
  it('should return a TypeScript template with a default import', async () => {
    const result = await getTypeScriptTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'default',
      componentIsDefaultExport: true,
      rendererPackage: '@storybook/react',
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import type { Meta, StoryObj } from '@storybook/react';

      import Foo from './foo';

      const meta = {
        component: Foo,
      } satisfies Meta<typeof Foo>;

      export default meta;

      type Story = StoryObj<typeof meta>;

      export const Default: Story = {};"
    `);
  });

  it('should return a TypeScript template with a named import', async () => {
    const result = await getTypeScriptTemplateForNewStoryFile({
      basenameWithoutExtension: 'foo',
      componentExportName: 'Example',
      componentIsDefaultExport: false,
      rendererPackage: '@storybook/react',
      exportedStoryName: 'Default',
    });

    expect(result).toMatchInlineSnapshot(`
      "import type { Meta, StoryObj } from '@storybook/react';

      import { Example } from './foo';

      const meta = {
        component: Example,
      } satisfies Meta<typeof Example>;

      export default meta;

      type Story = StoryObj<typeof meta>;

      export const Default: Story = {};"
    `);
  });
});
