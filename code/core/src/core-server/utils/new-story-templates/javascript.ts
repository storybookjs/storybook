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

  const argsString =
    data.args && Object.keys(data.args).length > 0
      ? `args: ${JSON.stringify(data.args, null, 2)},`
      : '';

  return dedent`
  ${importStatement}

  const meta = {
    component: ${importName},
  };

  export default meta;

  export const ${data.exportedStoryName} = {
    ${argsString}
  };
  `;
}
