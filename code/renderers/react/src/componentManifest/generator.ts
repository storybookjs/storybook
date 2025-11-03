import path from 'pathe';
import { recast } from 'storybook/internal/babel';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import {
  type ComponentManifest,
  type ComponentManifestGenerator,
  type PresetPropertyFn,
} from 'storybook/internal/types';

import { getCodeSnippet } from './generateCodeSnippet';
import { getComponentImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj, getReactDocgen } from './reactDocgen';
import { cachedFindUp, cachedReadFileSync, groupBy, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
}

export const componentManifestGenerator: PresetPropertyFn<
  'experimental_componentManifestGenerator'
> = async () => {
  return (async (storyIndexGenerator) => {
    invalidateCache();

    const startIndex = performance.now();
    const index = await storyIndexGenerator.getIndex();
    logger.verbose(`Story index generation took ${performance.now() - startIndex}ms`);

    const startPerformance = performance.now();

    const groupByComponentId = groupBy(
      Object.values(index.entries)
        .filter((entry) => entry.type === 'story')
        .filter((entry) => entry.subtype === 'story'),
      (it) => it.id.split('--')[0]
    );
    const singleEntryPerComponent = Object.values(groupByComponentId).flatMap((group) =>
      group && group?.length > 0 ? [group[0]] : []
    );
    const components = singleEntryPerComponent.map((entry): ReactComponentManifest | undefined => {
      const absoluteImportPath = path.join(process.cwd(), entry.importPath);
      const storyFile = cachedReadFileSync(absoluteImportPath, 'utf-8') as string;
      const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();

      if (csf.meta.tags?.includes('!manifest')) {
        return;
      }
      let componentName = csf._meta?.component;
      const title = entry.title.replace(/\s+/g, '');

      const id = entry.id.split('--')[0];
      const importPath = entry.importPath;

      const nearestPkg = cachedFindUp('package.json', {
        cwd: path.dirname(absoluteImportPath),
        last: process.cwd(),
      });
      const packageName = nearestPkg
        ? JSON.parse(cachedReadFileSync(nearestPkg, 'utf-8') as string).name
        : undefined;

      const fallbackImport =
        packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';
      const componentImports = getComponentImports({
        csf,
        packageName,
        storyFilePath: absoluteImportPath,
      });

      const calculatedImports = componentImports.imports.join('\n').trim() ?? fallbackImport;

      const component = componentImports.components.find((it) => {
        const nameMatch = componentName
          ? it.componentName === componentName ||
            it.localImportName === componentName ||
            it.importName === componentName
          : false;
        const titleMatch = !componentName
          ? (it.localImportName ? title.includes(it.localImportName) : false) ||
            (it.importName ? title.includes(it.importName) : false)
          : false;
        return nameMatch || titleMatch;
      });

      componentName ??=
        component?.componentName ?? component?.localImportName ?? component?.importName;

      const componentPath = component?.path;
      const importName = component?.importName;

      const stories = Object.keys(csf._stories)
        .map((storyName) => {
          const story = csf._stories[storyName];
          if (story.tags?.includes('!manifest')) {
            return;
          }
          try {
            const jsdocComment = extractDescription(csf._storyStatements[storyName]);
            const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
            const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

            return {
              name: storyName,
              snippet: recast.print(getCodeSnippet(csf, storyName, componentName)).code,
              description: finalDescription?.trim(),
              summary: tags.summary?.[0],
            };
          } catch (e) {
            invariant(e instanceof Error);
            return {
              name: storyName,
              error: { name: e.name, message: e.message },
            };
          }
        })
        .filter((it) => it != null);

      const base = {
        id,
        name: componentName ?? title,
        path: importPath,
        stories,
        import: calculatedImports,
        jsDocTags: {},
      } satisfies Partial<ComponentManifest>;

      if (!componentPath) {
        const error = !componentName
          ? {
              name: 'No meta.component specified',
              message: 'Specify meta.component for the component to be included in the manifest.',
            }
          : {
              name: 'No component import found',
              message: `No component file found for the "${componentName}" component.`,
            };
        return {
          ...base,
          error: {
            name: error.name,
            message:
              csf._metaStatementPath?.buildCodeFrameError(error.message).message ?? error.message,
          },
        };
      }

      const docgenResult = getReactDocgen(
        componentPath,
        component ? component : { componentName: componentName ?? title }
      );

      const docgen = docgenResult.type === 'success' ? docgenResult.data : undefined;
      const error = docgenResult.type === 'error' ? docgenResult.error : undefined;

      const metaDescription = extractDescription(csf._metaStatement);
      const jsdocComment = metaDescription || docgen?.description;
      const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};

      const manifestDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

      return {
        ...base,
        description: manifestDescription?.trim(),
        summary: tags.summary?.[0],
        import: calculatedImports,
        reactDocgen: docgen,
        jsDocTags: tags,
        error,
      };
    });

    logger.verbose(`Component manifest generation took ${performance.now() - startPerformance}ms`);

    return {
      v: 0,
      components: Object.fromEntries(
        components
          .filter((component) => component != null)
          .map((component) => [component.id, component])
      ),
    };
  }) satisfies ComponentManifestGenerator;
};
