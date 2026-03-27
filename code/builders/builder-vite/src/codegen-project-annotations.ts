import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
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
  const usedVariables = new Set<string>();
  for (const previewAnnotation of previewAnnotationURLs) {
    const baseVariable =
      genSafeVariableName(filename(previewAnnotation)).replace(/_(45|46|47)/g, '_') +
      '_' +
      hash(previewAnnotation);
    const variable = getUniqueImportVariable(baseVariable, usedVariables);
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
        // getProjectAnnotations has changed so we need to patch the new one in
        window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
          getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
        });
      });
    }
  `.trim();
}

function getUniqueImportVariable(baseVariable: string, usedVariables: Set<string>) {
  let variable = baseVariable;
  let duplicateCount = 2;

  while (usedVariables.has(variable)) {
    variable = `${baseVariable}_${duplicateCount}`;
    duplicateCount += 1;
  }

  usedVariables.add(variable);
  return variable;
}

/** djb2 hash - http://www.cse.yorku.ca/~oz/hash.html */
function hash(value: string) {
  let acc = 5381;
  for (let i = 0; i < value.length; i++) {
    acc = ((acc << 5) + acc + value.charCodeAt(i)) >>> 0;
  }
  return acc;
}
