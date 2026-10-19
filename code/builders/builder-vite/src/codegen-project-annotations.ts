import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { genArrayFromRaw, genImport, genSafeVariableName } from 'knitwork';
import { filename } from 'pathe/utils';
import { dedent } from 'ts-dedent';

import { toImportPath } from './utils/import-path.ts';
import { getModuleLoader } from './utils/module-loader.ts';
import { processPreviewAnnotation } from './utils/process-preview-annotation.ts';

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
  const moduleLoader = await getModuleLoader(options);

  return generateProjectAnnotationsCodeFromPreviews({
    previewAnnotations: [...previewAnnotations, previewOrConfigFile],
    projectRoot,
    frameworkName,
    isCsf4,
    moduleLoader,
  });
}

export function generateProjectAnnotationsCodeFromPreviews(options: {
  /** The last one is the project's preview file, or `undefined` if the project has none. */
  previewAnnotations: (PreviewAnnotation | undefined)[];
  projectRoot: string;
  frameworkName: string;
  isCsf4: boolean;
  /** A module whose `load(importPath, importFn)` loads the project's preview file. */
  moduleLoader?: string;
}) {
  const { projectRoot, moduleLoader } = options;
  const hasPreviewFile = options.previewAnnotations.at(-1) !== undefined;
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

  // Prefer the updated module from an HMR update, otherwise the original module
  const moduleAt = (index: number, variable: string) =>
    `hmrPreviewAnnotationModules[${index}] ?? ${variable}`;
  const loadPreviewFile = (module: string) =>
    moduleLoader
      ? `await load(${JSON.stringify(toImportPath(previewFileURL))}, async () => ${module})`
      : module;
  const loaderImport = moduleLoader ? `${genImport(moduleLoader, ['load'])}\n` : '';
  const maybeAsync = moduleLoader ? 'async ' : '';

  if (options.isCsf4) {
    return dedent`
      ${loaderImport}${previewFileImport}

      export ${maybeAsync}function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = ${loadPreviewFile(moduleAt(0, previewFileVariable))};
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
    ${loaderImport}
    ${imports.join('\n')}

    export ${maybeAsync}function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
      const configs = ${genArrayFromRaw(
        variables.map((variable, index) =>
          hasPreviewFile && index === variables.length - 1
            ? loadPreviewFile(moduleAt(index, variable))
            : moduleAt(index, variable)
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

/** djb2 hash — http://www.cse.yorku.ca/~oz/hash.html */
function hash(value: string) {
  let acc = 5381;
  for (let i = 0; i < value.length; i++) {
    acc = ((acc << 5) + acc + value.charCodeAt(i)) >>> 0;
  }
  return acc;
}
