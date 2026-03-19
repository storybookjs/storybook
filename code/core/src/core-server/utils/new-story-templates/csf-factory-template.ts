import { dedent } from 'ts-dedent';

import { getComponentVariableName } from '../get-component-variable-name';

interface CsfFactoryTemplateData {
  /** The components file name without the extension */
  basenameWithoutExtension: string;
  componentExportName: string;
  componentIsDefaultExport: boolean;
  /** The exported name of the default story */
  exportedStoryName: string;
  /** The import path for the preview config (if not provided, uses '#.storybook/preview') */
  previewImportPath?: string;
  /** The args to include in the story */
  args?: Record<string, any>;
}

export async function getCsfFactoryTemplateForNewStoryFile(data: CsfFactoryTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}';`
    : `import { ${importName} } from './${data.basenameWithoutExtension}';`;
  const previewImport = data.previewImportPath
    ? `import preview from '${data.previewImportPath}';`
    : `import preview from '#.storybook/preview';`;

  const argsString =
    data.args && Object.keys(data.args).length > 0
      ? `{ args: ${JSON.stringify(data.args, null, 2)} }`
      : '{}';

  return dedent`
  ${previewImport}

  ${importStatement}

  const meta = preview.meta({
    component: ${importName},
  });

  export const ${data.exportedStoryName} = meta.story(${argsString});
  `;
}
