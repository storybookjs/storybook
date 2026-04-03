import { dedent } from 'ts-dedent';

import { type BaseTemplateData, resolveComponentImport, serializeArgs } from './helpers.ts';

interface JavaScriptTemplateData extends BaseTemplateData {}

export async function getJavaScriptTemplateForNewStoryFile(data: JavaScriptTemplateData) {
  const { importName, importStatement } = await resolveComponentImport(data);

  const argsString = serializeArgs(data.args);
  const storyExport = argsString
    ? dedent`
      export const ${data.exportedStoryName} = {
        ${argsString}
      };
      `
    : `export const ${data.exportedStoryName} = {};`;

  return dedent`
  ${importStatement}

  const meta = {
    component: ${importName},
  };

  export default meta;

  ${storyExport}
  `;
}
