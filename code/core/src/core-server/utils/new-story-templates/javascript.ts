import { dedent } from 'ts-dedent';

import { getComponentVariableName } from '../get-component-variable-name';

interface JavaScriptTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The exported name of the default story */
  exportedStoryName: string;
  /** The args to include in the story */
  args?: Record<string, any>;
}

export async function getJavaScriptTemplateForNewStoryFile(data: JavaScriptTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}';`
    : `import { ${importName} } from './${data.basenameWithoutExtension}';`;

  const hasArgs = Boolean(data.args && Object.keys(data.args).length > 0);
  const argsString = hasArgs ? `args: ${JSON.stringify(data.args, null, 2)},` : '';
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
