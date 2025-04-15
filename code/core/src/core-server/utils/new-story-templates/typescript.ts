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
}

export async function getTypeScriptTemplateForNewStoryFile(data: TypeScriptTemplateData) {
  const importName = data.componentIsDefaultExport
    ? await getComponentVariableName(data.basenameWithoutExtension)
    : data.componentExportName;
  const importStatement = data.componentIsDefaultExport
    ? `import ${importName} from './${data.basenameWithoutExtension}'`
    : `import { ${importName} } from './${data.basenameWithoutExtension}'`;

  return dedent`
  import type { Meta, StoryObj } from '${data.frameworkPackage}';

  ${importStatement};

  const meta = {
    component: ${importName},
  } satisfies Meta<typeof ${importName}>;

  export default meta;

  type Story = StoryObj<typeof meta>;

  export const ${data.exportedStoryName}: Story = {};
  `;
}
