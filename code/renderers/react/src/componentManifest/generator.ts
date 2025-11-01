import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator, type PresetPropertyFn } from 'storybook/internal/types';
import { type ComponentManifest } from 'storybook/internal/types';

import * as find from 'empathic/find';
import path from 'pathe';

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
        const name = csf._meta?.component ?? entry.title.split('/').at(-1)!;
        const id = entry.id.split('--')[0];
        const importPath = entry.importPath;

        const stories = Object.keys(csf._stories)
          .map((storyName) => {
            try {
              return {
                name: storyName,
                snippet: recast.print(getCodeSnippet(csf, storyName, name)).code,
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

        const nearestPkg = find.up('package.json', {
          cwd: path.dirname(storyAbsPath),
          last: process.cwd(),
        });
        const packageName = nearestPkg
          ? JSON.parse(await readFile(nearestPkg, 'utf-8')).name
          : undefined;
        const fallbackImport = packageName ? `import { ${name} } from "${packageName}";` : '';
        const calculatedImports =
          getComponentImports(csf, packageName).imports.join('\n').trim() ?? fallbackImport;

        const base = {
          id,
          name,
          path: importPath,
          stories,
          import: calculatedImports,
          jsDocTags: {},
        } satisfies Partial<ComponentManifest>;

        if (!entry.componentPath) {
          const componentName = csf._meta?.component;

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
            name,
            stories,
            error: {
              name: error.name,
              message:
                csf._metaStatementPath?.buildCodeFrameError(error.message).message ?? error.message,
            },
          };
        }

        let componentFile;

        try {
          componentFile = await readFile(path.join(process.cwd(), entry.componentPath!), 'utf-8');
        } catch (e) {
          invariant(e instanceof Error);
          return {
            ...base,
            name,
            stories,
            error: {
              name: 'Component file could not be read',
              message: `Could not read the component file located at "${entry.componentPath}".\nPrefer relative imports.`,
            },
          };
        }

        const docgens = await parseWithReactDocgen({
          code: componentFile,
          filename: path.join(process.cwd(), entry.componentPath),
        });
        const docgen = getMatchingDocgen(docgens, csf);

        const error = !docgen
          ? {
              name: 'Docgen evaluation failed',
              message:
                `Could not parse props information for the component file located at "${entry.componentPath}"\n` +
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
          name,
          description: manifestDescription?.trim(),
          summary: tags.summary?.[0],
          reactDocgen: docgen,
          jsDocTags: tags,
          stories,
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
