import { recast } from 'storybook/internal/babel';
import { combineTags } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import {
  type ComponentManifest,
  type ComponentManifestGenerator,
  type PresetPropertyFn,
} from 'storybook/internal/types';

import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { getComponents, getImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj } from './reactDocgen';
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

      const manifestEnabled = csf.stories
        .map((it) => combineTags('manifest', ...(csf.meta.tags ?? []), ...(it.tags ?? [])))
        .some((it) => it.includes('manifest'));

      if (!manifestEnabled) {
        return;
      }
      const componentName = csf._meta?.component;

      const id = entry.id.split('--')[0];
      const importPath = entry.importPath;

      const components = getComponents({ csf, storyFilePath: absoluteImportPath });

      const trimmedTitle = entry.title.replace(/\s+/g, '');

      const component = components.find((it) => {
        return componentName
          ? [it.componentName, it.localImportName, it.importName].includes(componentName)
          : trimmedTitle.includes(it.componentName) ||
              (it.localImportName && trimmedTitle.includes(it.localImportName)) ||
              (it.importName && trimmedTitle.includes(it.importName));
      });

      const stories = Object.keys(csf._stories)
        .map((storyName) => {
          const story = csf._stories[storyName];

          const manifestEnabled = combineTags(
            'manifest',
            ...(csf.meta.tags ?? []),
            ...(story.tags ?? [])
          ).includes('manifest');

          if (!manifestEnabled) {
            return;
          }
          try {
            const jsdocComment = extractDescription(csf._storyStatements[storyName]);
            const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
            const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

            return {
              name: storyName,
              snippet: recast.print(getCodeSnippet(csf, storyName, component?.componentName)).code,
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

      const nearestPkg = cachedFindUp('package.json', {
        cwd: path.dirname(component?.path ?? absoluteImportPath),
      });

      let packageName;
      try {
        packageName = nearestPkg
          ? JSON.parse(cachedReadFileSync(nearestPkg, 'utf-8') as string).name
          : undefined;
      } catch {}

      const fallbackImport =
        packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';

      const imports = getImports({ components, packageName }).join('\n').trim() || fallbackImport;

      const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

      const base = {
        id,
        name: componentName ?? title,
        path: importPath,
        stories,
        import: imports,
        jsDocTags: {},
      } satisfies Partial<ComponentManifest>;

      if (!component?.reactDocgen) {
        const error = !component
          ? {
              name: 'No meta.component specified',
              message: 'Specify meta.component for the component to be included in the manifest.',
            }
          : {
              name: 'No component import found',
              message: `No component file found for the "${component.componentName}" component.`,
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

      const docgenResult = component.reactDocgen;

      const docgen = docgenResult.type === 'success' ? docgenResult.data : undefined;
      const error = docgenResult.type === 'error' ? docgenResult.error : undefined;

      const jsdocComment = extractDescription(csf._metaStatement) || docgen?.description;
      const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};

      return {
        ...base,
        description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
        summary: tags.summary?.[0],
        import: imports,
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
