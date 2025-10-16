import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator } from 'storybook/internal/types';

import path from 'pathe';

import { convertReactDocgenToJSONSchemas } from './docgen-to-json-schema';
import { getCodeSnippet } from './generateCodeSnippet';
import { extractJSDocTags, removeTags } from './jsdoc-tags';
import { getMatchingDocgen, parseWithReactDocgen } from './react-docgen';
import { groupBy } from './utils';

export const componentManifestGenerator = async () => {
  return (async (storyIndexGenerator) => {
    const index = await storyIndexGenerator.getIndex();
    const groupByComponentId = groupBy(
      Object.values(index.entries).filter(
        (entry) => entry.type === 'story' && entry.subtype === 'story' && entry.componentPath
      ),
      (it) => it.id.split('--')[0]
    );
    const singleEntryPerComponent = Object.values(groupByComponentId).flatMap((group) =>
      group && group?.length > 0 ? [group[0]] : []
    );
    const components = await Promise.all(
      singleEntryPerComponent.map(async (entry) => {
        const storyFile = await readFile(path.join(process.cwd(), entry.importPath), 'utf-8');
        const componentFile = await readFile(
          path.join(process.cwd(), entry.componentPath!),
          'utf-8'
        );
        const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();
        const componentName = csf._meta?.component;
        const docgens = await parseWithReactDocgen({
          code: componentFile,
          filename: path.join(process.cwd(), entry.importPath),
        });
        const docgen = getMatchingDocgen(docgens, componentName);

        const metaDescription = extractDescription(csf._metaStatement);
        const description = metaDescription || docgen?.description;
        const tags = description ? extractJSDocTags(description) : {};

        return {
          id: entry.id.split('--')[0],
          name: componentName,
          description: description ? removeTags(description) : undefined,
          jsdocTag: tags,
          summary: tags.summary ? tags.summary[0] : undefined,
          import: tags.import ? tags.import[0] : undefined,
          props: docgen?.props ? convertReactDocgenToJSONSchemas(docgen) : undefined,
          examples: !componentName
            ? []
            : Object.entries(csf._storyPaths)
                .map(([name, path]) => ({
                  name,
                  snippet: recast.print(getCodeSnippet(path, csf._metaNode ?? null, componentName))
                    .code,
                }))
                .filter(Boolean),
        };
      })
    );

    return Object.fromEntries(components.map((component) => [component.id, component]));
  }) satisfies ComponentManifestGenerator;
};
