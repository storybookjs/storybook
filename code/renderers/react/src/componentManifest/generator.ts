import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { recast } from 'storybook/internal/babel';
import { resolveImport } from 'storybook/internal/common';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import {
  type ComponentManifest,
  type ComponentManifestGenerator,
  type PresetPropertyFn,
} from 'storybook/internal/types';

import * as find from 'empathic/find';
import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { getComponentImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj, getReactDocgen, invalidateCache, matchPath } from './reactDocgen';
import { groupBy, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
}

export const componentManifestGenerator: PresetPropertyFn<
  'experimental_componentManifestGenerator'
> = async () => {
  return (async (storyIndexGenerator) => {
    invalidateCache();
    const index = await storyIndexGenerator.getIndex();

    const groupByComponentId = groupBy(
      Object.values(index.entries)
        .filter((entry) => entry.type === 'story')
        .filter((entry) => entry.subtype === 'story'),
      (it) => it.id.split('--')[0]
    );
    const singleEntryPerComponent = Object.values(groupByComponentId).flatMap((group) =>
      group && group?.length > 0 ? [group[0]] : []
    );
    const components = await Promise.all(
      singleEntryPerComponent.flatMap(async (entry): Promise<ReactComponentManifest> => {
        const storyAbsPath = path.join(process.cwd(), entry.importPath);
        const storyFile = await readFile(storyAbsPath, 'utf-8');
        const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();
        let componentName = csf._meta?.component;
        const title = entry.title.replace(/\s+/g, '');

        const id = entry.id.split('--')[0];
        const importPath = entry.importPath;

        const nearestPkg = find.up('package.json', {
          cwd: path.dirname(storyAbsPath),
          last: process.cwd(),
        });
        const packageName = nearestPkg
          ? JSON.parse(await readFile(nearestPkg, 'utf-8')).name
          : undefined;

        const fallbackImport =
          packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';
        const componentImports = getComponentImports(csf, packageName);

        const calculatedImports = componentImports.imports.join('\n').trim() ?? fallbackImport;

        const component = componentImports.components.find((it) => {
          const nameMatch = componentName
            ? it.componentName === componentName || it.localImportName === componentName || it.importName === componentName
            : false;
          const titleMatch = !componentName
            ? (it.localImportName ? title.includes(it.localImportName) : false) ||
              (it.importName ? title.includes(it.importName) : false)
            : false;
          return nameMatch || titleMatch;
        });

        componentName ??= component?.localImportName ?? component?.importName ?? component?.componentName;

        let componentPath;
        const importName = component?.importName;

        if (component && component.importId) {
          const id = component.importId;
          const matchedPath = matchPath(id);
          let resolved;
          try {
            resolved = resolveImport(matchedPath, { basedir: dirname(storyAbsPath) });
            componentPath = resolved;
          } catch (e) {
            console.error(e);
          }
        }

        const stories = Object.keys(csf._stories)
          .map((storyName) => {
            try {
              return {
                name: storyName,
                snippet: recast.print(getCodeSnippet(csf, storyName, componentName)).code,
              };
            } catch (e) {
              invariant(e instanceof Error);
              return {
                name: storyName,
                error: { name: e.name, message: e.message },
              };
            }
          })
          .filter(Boolean);

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

        const docgenResult = await getReactDocgen(componentPath, importName);

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
          import: tags.import?.[0] ?? calculatedImports,
          reactDocgen: docgen,
          jsDocTags: tags,
          error,
        };
      })
    );

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
