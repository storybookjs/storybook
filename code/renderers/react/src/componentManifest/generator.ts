import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator } from 'storybook/internal/types';
import { type ComponentManifest } from 'storybook/internal/types';

import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj, getMatchingDocgen, parseWithReactDocgen } from './reactDocgen';
import { groupBy, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
}

export const componentManifestGenerator = async () => {
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
        const storyFile = await readFile(path.join(process.cwd(), entry.importPath), 'utf-8');
        const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();
        const name = csf._meta?.component ?? entry.title.split('/').at(-1)!;
        const id = entry.id.split('--')[0];
        const importPath = entry.importPath;

        const examples = Object.keys(csf._stories)
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
                error: {
                  message: e.message,
                },
              };
            }
          })
          .filter(Boolean);

        const base = {
          id,
          name,
          path: importPath,
          examples,
          jsDocTags: {},
        } satisfies Partial<ComponentManifest>;

        if (!entry.componentPath) {
          const message = `No component file found for the "${name}" component.`;
          return {
            ...base,
            name,
            examples,
            error: { message },
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
            examples,
            error: {
              message: `Could not read the component file located at ${entry.componentPath}`,
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
              message: `Could not parse props information for the located at ${entry.componentPath}`,
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
          import: tags.import?.[0],
          reactDocgen: docgen,
          jsDocTags: tags,
          examples,
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
