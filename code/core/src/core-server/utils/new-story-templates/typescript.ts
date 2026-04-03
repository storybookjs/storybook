import { dedent } from 'ts-dedent';

import { type BaseTemplateData, resolveComponentImport, serializeArgs } from './helpers.ts';

interface TypeScriptTemplateData extends BaseTemplateData {
  /** The framework package name, e.g. @storybook/nextjs */
  frameworkPackage: string;
}

export async function getTypeScriptTemplateForNewStoryFile(data: TypeScriptTemplateData) {
  const { importName, importStatement } = await resolveComponentImport(data);

  const argsString = serializeArgs(data.args);
  const storyExport = argsString
    ? dedent`
      export const ${data.exportedStoryName}: Story = {
        ${argsString}
      };
      `
    : `export const ${data.exportedStoryName}: Story = {};`;

  return dedent`
  import type { Meta, StoryObj } from '${data.frameworkPackage}';

  ${importStatement}

  const meta = {
    component: ${importName},
  } satisfies Meta<typeof ${importName}>;

  export default meta;

  type Story = StoryObj<typeof meta>;

  ${storyExport}
  `;
}
