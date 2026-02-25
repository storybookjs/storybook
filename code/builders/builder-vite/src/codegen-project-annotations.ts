import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import { STORY_HOT_UPDATED } from 'storybook/internal/core-events';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { genArrayFromRaw, genImport, genSafeVariableName } from 'knitwork';
import { filename } from 'pathe/utils';
import { dedent } from 'ts-dedent';

import { processPreviewAnnotation } from './utils/process-preview-annotation';

/** Generates the code for the `PROJECT_ANNOTATIONS_FILE` virtual module. */
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

  const previewFileURL = previewAnnotationURLs[previewAnnotationURLs.length - 1];
  const previewFileVariable = variables[variables.length - 1];
  const previewFileImport = imports[imports.length - 1];

  if (options.isCsf4) {
    return dedent`
      ${previewFileImport}

      export function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = hmrPreviewAnnotationModules[0] ?? ${previewFileVariable};
        return preview.default.composed;
      }

      if (import.meta.hot) {
        import.meta.hot.accept([${JSON.stringify(previewFileURL)}], (previewAnnotationModules) => {
          // Cancel any running play function before patching in the new getProjectAnnotations
          window?.__STORYBOOK_PREVIEW__?.channel?.emit('${STORY_HOT_UPDATED}');
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }
    `.trim();
  }

  return dedent`
    import { composeConfigs } from 'storybook/preview-api';

    ${imports.join('\n')}

    export function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
      const configs = ${genArrayFromRaw(
        variables.map(
          (previewAnnotation, index) =>
            // Prefer the updated module from an HMR update, otherwise the original module
            `hmrPreviewAnnotationModules[${index}] ?? ${previewAnnotation}`
        ),
        '  '
      )};
      return composeConfigs(configs);
    }

    if (import.meta.hot) {
      import.meta.hot.accept(${JSON.stringify(previewAnnotationURLs)}, (previewAnnotationModules) => {
        // Cancel any running play function before patching in the new getProjectAnnotations
        window?.__STORYBOOK_PREVIEW__?.channel?.emit('${STORY_HOT_UPDATED}');
        // getProjectAnnotations has changed so we need to patch the new one in
        window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
          getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
        });
      });
    }
  `.trim();
}

function hash(value: string) {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
