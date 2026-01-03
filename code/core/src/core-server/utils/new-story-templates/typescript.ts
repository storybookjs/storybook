import { dedent } from 'ts-dedent';

import { getComponentVariableName } from '../get-component-variable-name';

interface TypeScriptTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The framework package name, e.g. @storybook/nextjs */
  frameworkPackage: string;
  /** The exported name of the default story */
  exportedStoryName: string;
  /** The args to include in the story */
  args?: Record<string, any>;
  /** The custom tags to add to the story */
  tags?: string[];
}

export async function getTypeScriptTemplateForNewStoryFile(data: TypeScriptTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}'`
    : `import { ${importName} } from './${data.basenameWithoutExtension}'`;

  const hasArgs = Boolean(data.args && Object.keys(data.args).length > 0);
  const argsString = hasArgs ? `args: ${JSON.stringify(data.args, null, 2)},` : '';
  const storyExport = hasArgs
    ? dedent`
      export const ${data.exportedStoryName}: Story = {
        ${argsString}
      };
      `
    : `export const ${data.exportedStoryName}: Story = {};`;

  const tagsString =
    data.tags && Array.isArray(data.tags) && data.tags.length > 0
      ? `tags: ${JSON.stringify(data.tags)},`
      : '';

  return dedent`
  import type { Meta, StoryObj } from '${data.frameworkPackage}';

  ${importStatement};

  const meta = {
    component: ${importName},
    ${tagsString}
  } satisfies Meta<typeof ${importName}>;

  export default meta;

  type Story = StoryObj<typeof meta>;

  ${storyExport}
  `;
}
