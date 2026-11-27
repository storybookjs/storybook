import { getFrameworkName, loadPreviewOrConfigFile } from 'storybook/internal/common';
import { isCsfFactoryPreview, readConfig } from 'storybook/internal/csf-tools';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { genArrayFromRaw, genImport, genSafeVariableName } from 'knitwork';
import { filename } from 'pathe/utils';
import { dedent } from 'ts-dedent';

import { toImportPath } from './utils/import-path.ts';
import {
  genImportThroughModuleImporters,
  genModuleImporterImports,
  getModuleImporters,
} from './utils/module-importer.ts';
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
  const moduleImporters = await getModuleImporters(options);

  return generateProjectAnnotationsCodeFromPreviews({
    previewAnnotations,
    previewFile: previewOrConfigFile,
    projectRoot,
    frameworkName,
    isCsf4,
    moduleImporters,
  });
}

export function generateProjectAnnotationsCodeFromPreviews(options: {
  /** The preview annotations of presets and addons. */
  previewAnnotations: (PreviewAnnotation | undefined)[];
  /** The project's preview file. */
  previewFile?: PreviewAnnotation;
  projectRoot: string;
  frameworkName: string;
  isCsf4: boolean;
  /** Modules whose `importModule(importPath, importFn)` import the project's preview file. */
  moduleImporters?: string[];
}) {
  const { projectRoot, moduleImporters = [] } = options;

  const toModule = (previewAnnotation: PreviewAnnotation) => {
    const url = processPreviewAnnotation(previewAnnotation, projectRoot);
    const variable =
      genSafeVariableName(filename(url)).replace(/_(45|46|47)/g, '_') + '_' + hash(url);
    return { url, variable, import: genImport(url, { name: '*', as: variable }) };
  };
  // A preset may leave an undefined entry
  const annotations = options.previewAnnotations.filter((path) => path !== undefined).map(toModule);
  const previewFile = options.previewFile ? toModule(options.previewFile) : undefined;
  // The importers import the preview file only
  const hasImporters = moduleImporters.length > 0 && previewFile !== undefined;

  // Prefer the updated module from an HMR update, otherwise the original module
  const moduleAt = (index: number, variable: string) =>
    `hmrPreviewAnnotationModules[${index}] ?? ${variable}`;
  const loadPreviewFile = ({ url, variable }: ReturnType<typeof toModule>, index: number) => {
    if (!hasImporters) {
      return moduleAt(index, variable);
    }
    const importPath = JSON.stringify(toImportPath(url));
    // The build's import of the preview file, which imports no other path
    const importFn =
      `async (path) => path === ${importPath} ? ${moduleAt(index, variable)} : ` +
      `Promise.reject(new Error(\`The preview file's importFn can't import \${path}\`))`;
    return `await ${genImportThroughModuleImporters(moduleImporters, importPath, importFn)}`;
  };
  // After the module imports, with a blank line, so without importers the code stays the same
  const importerImports = hasImporters ? `\n\n${genModuleImporterImports(moduleImporters)}` : '';
  const maybeAsync = hasImporters ? 'async ' : '';

  if (options.isCsf4 && previewFile) {
    return dedent`
      ${previewFile.import}${importerImports}

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

    ${modules.map((module) => module.import).join('\n')}${importerImports}

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
