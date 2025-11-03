import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
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
import { type DocObj, getReactDocgen } from './reactDocgen';
import { groupBy, invalidateCache, invariant } from './utils';

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
      singleEntryPerComponent.map(async (entry): Promise<ReactComponentManifest | undefined> => {
        const absoluteImportPath = path.join(process.cwd(), entry.importPath);
        const storyFile = await readFile(absoluteImportPath, 'utf-8');
        const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();

        if (csf.meta.tags?.includes('!manifest')) {
          return;
        }
        let componentName = csf._meta?.component;
        const title = entry.title.replace(/\s+/g, '');

        const id = entry.id.split('--')[0];
        const importPath = entry.importPath;

        const nearestPkg = find.up('package.json', {
          cwd: path.dirname(absoluteImportPath),
          last: process.cwd(),
        });
        const packageName = nearestPkg
          ? JSON.parse(await readFile(nearestPkg, 'utf-8')).name
          : undefined;

        const fallbackImport =
          packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';
        const componentImports = await getComponentImports({
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
