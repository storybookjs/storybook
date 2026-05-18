import { dedent } from 'ts-dedent';

import type { BaseTemplateData } from './helpers.ts';
import { resolveComponentImport } from './helpers.ts';

interface CsfFactoryTemplateData extends BaseTemplateData {
  /** The import path for the preview config (if not provided, uses '#.storybook/preview') */
  previewImportPath?: string;
}

export async function getCsfFactoryTemplateForNewStoryFile(data: CsfFactoryTemplateData) {
  const { importName, importStatement } = await resolveComponentImport(data);
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
