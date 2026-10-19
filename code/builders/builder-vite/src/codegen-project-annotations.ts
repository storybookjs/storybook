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
    previewAnnotations,
    previewFile: previewOrConfigFile,
    projectRoot,
    frameworkName,
    isCsf4,
    moduleLoader,
  });
}

export function generateProjectAnnotationsCodeFromPreviews(options: {
  /** The preview annotations of presets and addons. */
  previewAnnotations: PreviewAnnotation[];
  /** The project's preview file. */
  previewFile?: PreviewAnnotation;
  projectRoot: string;
  frameworkName: string;
  isCsf4: boolean;
  /** A module whose `load(importPath, importFn)` loads the project's preview file. */
  moduleLoader?: string;
}) {
  const { projectRoot, moduleLoader } = options;

  const toModule = (previewAnnotation: PreviewAnnotation) => {
    const url = processPreviewAnnotation(previewAnnotation, projectRoot);
    const variable =
      genSafeVariableName(filename(url)).replace(/_(45|46|47)/g, '_') + '_' + hash(url);
    return { url, variable, import: genImport(url, { name: '*', as: variable }) };
  };
  const annotations = options.previewAnnotations.map(toModule);
  const previewFile = options.previewFile ? toModule(options.previewFile) : undefined;

  // Prefer the updated module from an HMR update, otherwise the original module
  const moduleAt = (index: number, variable: string) =>
    `hmrPreviewAnnotationModules[${index}] ?? ${variable}`;
  const loadPreviewFile = ({ url, variable }: ReturnType<typeof toModule>, index: number) =>
    moduleLoader
      ? `await load(${JSON.stringify(toImportPath(url))}, async () => ${moduleAt(index, variable)})`
      : moduleAt(index, variable);
  const loaderImport = moduleLoader ? `${genImport(moduleLoader, ['load'])}\n` : '';
  const maybeAsync = moduleLoader ? 'async ' : '';

  if (options.isCsf4 && previewFile) {
    return dedent`
      ${loaderImport}${previewFile.import}

      export ${maybeAsync}function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
        const preview = ${loadPreviewFile(previewFile, 0)};
        return preview.default.composed;
      }

      if (import.meta.hot) {
        import.meta.hot.accept([${JSON.stringify(previewFile.url)}], (previewAnnotationModules) => {
          // getProjectAnnotations has changed so we need to patch the new one in
          window?.__STORYBOOK_PREVIEW__?.onGetProjectAnnotationsChanged({
            getProjectAnnotations: () => getProjectAnnotations(previewAnnotationModules),
          });
        });
      }
    `.trim();
  }

  const modules = previewFile ? [...annotations, previewFile] : annotations;
  const configs = annotations.map(({ variable }, index) => moduleAt(index, variable));
  if (previewFile) {
    configs.push(loadPreviewFile(previewFile, annotations.length));
  }

  return dedent`
    import { composeConfigs } from 'storybook/preview-api';
    ${loaderImport}
    ${modules.map((module) => module.import).join('\n')}

    export ${maybeAsync}function getProjectAnnotations(hmrPreviewAnnotationModules = []) {
      const configs = ${genArrayFromRaw(configs, '  ')};
      return composeConfigs(configs);
    }

    if (import.meta.hot) {
      import.meta.hot.accept(${JSON.stringify(modules.map((module) => module.url))}, (previewAnnotationModules) => {
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
