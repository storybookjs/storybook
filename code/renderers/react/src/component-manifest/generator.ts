import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator } from 'storybook/internal/types';

import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';

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
        const code = await readFile(path.join(process.cwd(), entry.importPath), 'utf-8');
        const csf = loadCsf(code, { makeTitle: (title) => title ?? 'No title' }).parse();
        const componentName = csf._meta?.component;
        return {
          id: entry.id.split('--')[0],
          name: componentName,
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
