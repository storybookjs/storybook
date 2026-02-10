import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { genImport, genSafeVariableName } from 'knitwork';
import { filename } from 'pathe/utils';
import { dedent } from 'ts-dedent';

import { processPreviewAnnotation } from './utils/process-preview-annotation';

/**
 * Generates the code for the `PROJECT_ANNOTATIONS_FILE` virtual module.
 *
 * This virtual module encapsulates the `getProjectAnnotations` function which composes all preview
 * annotations (from addons, frameworks, and the user's preview file) into a single configuration
 * object used by Storybook's runtime.
 *
 * The generated module can be imported as:
 *
 * ```ts
 * import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
 * ```
 *
 * This decouples the project annotations logic from the main iframe entry script, making it
 * reusable by other consumers (e.g., addon-vitest).
 */
export async function generateProjectAnnotationsCode(options: Options, projectRoot: string) {
  const { presets, configDir } = options;
  const frameworkName = await getFrameworkName(options);

  const previewOrConfigFile = loadPreviewOrConfigFile({ configDir });
  const previewConfig = previewOrConfigFile ? await readConfig(previewOrConfigFile) : undefined;
  const isCsf4 = previewConfig ? isCsfFactoryPreview(previewConfig) : false;

  const previewAnnotations = await presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );

  return generateProjectAnnotationsCodeFromPreviews({
    previewAnnotations: [...previewAnnotations, previewOrConfigFile],
    projectRoot,
    frameworkName,
    isCsf4,
  });
}

export function generateProjectAnnotationsCodeFromPreviews(options: {
  previewAnnotations: (PreviewAnnotation | undefined)[];
  projectRoot: string;
  frameworkName: string;
  isCsf4: boolean;
}) {
  const { projectRoot } = options;
  const previewAnnotationURLs = options.previewAnnotations
    .filter((path) => path !== undefined)
    .map((path) => processPreviewAnnotation(path, projectRoot));

  const variables: string[] = [];
  const imports: string[] = [];
  for (const previewAnnotation of previewAnnotationURLs) {
    const variable =
      genSafeVariableName(filename(previewAnnotation)).replace(/_(45|46|47)/g, '_') +
      '_' +
      hash(previewAnnotation);
    variables.push(variable);
    imports.push(genImport(previewAnnotation, { name: '*', as: variable }));
  }

  const previewFileVariable = variables[variables.length - 1];
  const previewFileImport = imports[imports.length - 1];

  if (options.isCsf4) {
    return dedent`
      ${previewFileImport}

      export function getProjectAnnotations() {
        return ${previewFileVariable}.default.composed;
      }
    `.trim();
  }

  return dedent`
    import { composeConfigs } from 'storybook/preview-api';

    ${imports.join('\n')}

    export function getProjectAnnotations() {
      return composeConfigs([${variables.join(', ')}]);
    }
  `.trim();
}

function hash(value: string) {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
