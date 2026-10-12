import { dedent } from 'ts-dedent';

import { getComponentVariableName } from '../get-component-variable-name';
import { escapeForTemplate } from '../safeString';

interface JavaScriptTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The exported name of the default story */
  exportedStoryName: string;
}

export async function getJavaScriptTemplateForNewStoryFile(data: JavaScriptTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importPath = `./${escapeForTemplate(data.basenameWithoutExtension)}`;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from '${importPath}';`
    : `import { ${importName} } from '${importPath}';`;

  return dedent`
  ${importStatement}

  const meta = {
    component: ${importName},
  };
  
  export default meta;
  
  export const ${data.exportedStoryName} = {};
  `;
}
