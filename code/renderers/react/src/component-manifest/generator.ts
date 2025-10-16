import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator } from 'storybook/internal/types';

import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { getMatchingDocgen, parseWithReactDocgen } from './react-docgen';

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
        return {
          id: entry.id.split('--')[0],
          name: componentName,
          description: metaDescription || docgen?.description,
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

// Object.groupBy polyfill
const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
) => {
  return items.reduce<Partial<Record<K, T[]>>>((acc = {}, item, index) => {
    const key = keySelector(item, index);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
};
