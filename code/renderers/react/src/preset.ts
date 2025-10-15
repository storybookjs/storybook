import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import type { PresetProperty } from 'storybook/internal/types';
import { type ComponentManifestGenerator } from 'storybook/internal/types';

import path from 'pathe';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';
import { getCodeSnippet } from './component-manifest/generateCodeSnippet';

export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/react-dom-shim/preset'),
];

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
        const csf = loadCsf(code, { makeTitle: (title) => title }).parse();
        const component = csf._meta?.component ?? 'Unknown';
        return {
          id: entry.id.split('--')[0],
          examples: Object.entries(csf._storyPaths)
            .map(([name, path]) => ({
              name,
              snippet: recast.print(getCodeSnippet(path, csf._metaNode ?? null, component)).code,
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

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const [docsConfig, features] = await Promise.all([
    options.presets.apply('docs', {}, options),
    options.presets.apply('features', {}, options),
  ]);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  const experimentalRSC = features?.experimentalRSC;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview')),
      fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-argtypes')),
    ])
    .concat(
      docsEnabled ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-docs'))] : []
    )
    .concat(
      experimentalRSC
        ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-rsc'))]
        : []
    );
};

/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 *
 * We do the exact same thing in the common preset, but that will fail in Yarn PnP because
 *
 * Storybook/internal/core-server doesn't have a peer dependency on react This will make
 *
 * @storybook/react projects work in Yarn PnP
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react'),
      reactDom: resolvePackageDir('react-dom'),
    };
  } catch (e) {
    return existing;
  }
};
