import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { recast } from 'storybook/internal/babel';
import { getProjectRoot, resolveImport, supportedExtensions } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator, type PresetPropertyFn } from 'storybook/internal/types';
import { type ComponentManifest } from 'storybook/internal/types';

import * as find from 'empathic/find';
import path from 'pathe';
import * as TsconfigPaths from 'tsconfig-paths';

import { getCodeSnippet } from './generateCodeSnippet';
import { getComponentImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj, getMatchingDocgen, parseWithReactDocgen } from './reactDocgen';
import { groupBy, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
}

export const componentManifestGenerator: PresetPropertyFn<
  'experimental_componentManifestGenerator'
> = async (config, options) => {
  return (async (storyIndexGenerator) => {
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
          return componentName
            ? it.localName === componentName || it.importName === componentName
            : title.includes(it.localName) || (it.importName && title.includes(it.importName));
        });

        componentName ??= component?.localName;

        let componentPath;
        const importName = component?.importName;

        if (component && component.importId) {
          const id = component.importId;
          const tsconfigPath = find.up('tsconfig.json', {
            cwd: process.cwd(),
            last: getProjectRoot(),
          });
          const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);
          let matchPath: TsconfigPaths.MatchPath | undefined;
          if (tsconfig.resultType === 'success') {
            matchPath = TsconfigPaths.createMatchPath(tsconfig.absoluteBaseUrl, tsconfig.paths, [
              'browser',
              'module',
              'main',
            ]);
          }
          const matchedPath = matchPath?.(id, undefined, undefined, supportedExtensions) ?? id;
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

        let componentFile;

        try {
          componentFile = await readFile(componentPath, 'utf-8');
        } catch (e) {
          invariant(e instanceof Error);
          return {
            ...base,
            stories,
            error: {
              name: 'Component file could not be read',
              message: `Could not read the component file located at "${componentPath}".\nPrefer relative imports.`,
            },
          };
        }

        const docgens = await parseWithReactDocgen({
          code: componentFile,
          filename: path.join(process.cwd(), componentPath),
        });
        const docgen = getMatchingDocgen(docgens, importName);

        const error = !docgen
          ? {
              name: 'Docgen evaluation failed',
              message:
                `Could not parse props information for the component file located at "${componentPath}"\n` +
                `Avoid barrel files when importing your component file.\n` +
                `Prefer relative imports if possible.\n` +
                `Avoid pointing to transpiled files.\n` +
                `You can debug your component file in this playground: https://react-docgen.dev/playground`,
            }
          : undefined;

        const metaDescription = extractDescription(csf._metaStatement);
        const jsdocComment = metaDescription || docgen?.description;
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};

        const manifestDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        return {
          ...base,
          description: manifestDescription?.trim(),
          summary: tags.summary?.[0],
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
