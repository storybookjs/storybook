import { dedent } from 'ts-dedent';

import { getComponentVariableName } from '../get-component-variable-name';

interface CsfFactoryTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The exported name of the default story */
  exportedStoryName: string;
}

export async function getCsfFactoryTemplateForNewStoryFile(data: CsfFactoryTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}';`
    : `import { ${importName} } from './${data.basenameWithoutExtension}';`;
  const previewImport = `import preview from '#.storybook/preview';`;
  return dedent`
  ${previewImport}
  
  ${importStatement}

  const meta = preview.meta({
    component: ${importName},
  });
  
  export const ${data.exportedStoryName} = meta.story({});
  `;
}
