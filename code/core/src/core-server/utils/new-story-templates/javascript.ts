import { dedent } from 'ts-dedent';

import type { BaseTemplateData } from './helpers.ts';
import { resolveComponentImport, serializeArgs } from './helpers.ts';

type JavaScriptTemplateData = BaseTemplateData;

export async function getJavaScriptTemplateForNewStoryFile(data: JavaScriptTemplateData) {
  const { importName, importStatement } = await resolveComponentImport(data);
  const { hasArgs, argsString } = serializeArgs(data.args);
  const storyExport = hasArgs
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
