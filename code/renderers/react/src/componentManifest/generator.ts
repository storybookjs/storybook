import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from 'storybook/internal/common';
import type { IndexEntry } from 'storybook/internal/types';
import { type PresetPropertyFn, type StorybookConfigRaw } from 'storybook/internal/types';

import path from 'pathe';

import {
  type DocgenEngine,
  buildReactComponentDocgenFromResolved,
} from './buildReactComponentDocgen.ts';
import { getSharedComponentMetaManager } from './componentMetaManagerSingleton.ts';
import { type ComponentRef, type TypescriptOptions } from './getComponentImports.ts';
import { invalidateParser } from './reactDocgenTypescript.ts';
import { resolveStoryFileComponents } from './resolveComponents.ts';
import { invalidateCache } from './utils.ts';

export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const { manifestEntries, presets, watch } = options;
  const typescriptOptions =
    (await presets?.apply<Partial<TypescriptOptions>>('typescript', {})) ?? {};
  const features = await presets?.apply('features', {});

  if (features?.experimentalDocgenServer) {
    /**
     * Docgen payloads live in the open service when this flag is on; core reads them via JSON refs
     * and the HTML debugger. We still emit an empty `components` manifest so renderer-owned metadata
     * (notably `meta.docgen` for the debugger UI) flows through `experimental_manifests` without
     * core hardcoding engine identifiers.
     */
    return {
      ...existingManifests,
      components: {
        v: 0,
        components: {},
        meta: { docgen: 'react-component-meta', durationMs: 0 },
      },
    };
  }

  const docgenEngine: DocgenEngine = features?.experimentalReactComponentMeta
    ? 'react-component-meta'
    : typescriptOptions.reactDocgen || 'react-docgen';

  invalidateCache();
  invalidateParser();

  const startTime = performance.now();
  const manager =
    docgenEngine === 'react-component-meta' ? await getSharedComponentMetaManager() : undefined;

  const entriesByUniqueComponent = [
    ...selectComponentEntriesByComponentId(manifestEntries).values(),
  ];

  // Step 1: Resolve components for all entries (one CSF file each).
  const resolvedEntries = await Promise.all(
    entriesByUniqueComponent.map(async (entry) => {
      const storyFilePath = getStoryImportPathFromEntry(entry);
      if (!storyFilePath) {
        throw new Error(`No story file path for index entry ${entry.id}`);
      }
      const storyPath = path.join(process.cwd(), storyFilePath);
      const resolved = await resolveStoryFileComponents({
        storyPath,
        title: entry.title,
        typescriptOptions,
        docgenEngine,
      });
      return { entry, storyFilePath, ...resolved };
    })
  );

  // Step 2: Batch extract rcm props (one TS program build per tsconfig project)
  if (docgenEngine === 'react-component-meta' && manager) {
    manager.batchExtract(
      resolvedEntries.flatMap(({ storyPath, component, subcomponents }) => [
        ...(component ? [{ storyPath, component }] : []),
        ...subcomponents
          .filter(
            (subcomponent): subcomponent is { component: ComponentRef; name: string } =>
              subcomponent.component !== undefined
          )
          .map((subcomponent) => ({
            storyPath,
            component: subcomponent.component,
          })),
      ])
    );
  }

  // Step 3: Build manifests
  const manifestEntryIds = new Set(manifestEntries.map((entry) => entry.id));
  const components = resolvedEntries
    .map(
      ({
        storyPath,
        component,
        entry,
        storyFilePath,
        storyFile,
        csf,
        componentName,
        allComponents,
        subcomponents,
      }) =>
        buildReactComponentDocgenFromResolved({
          entry,
          storyPath,
          storyFilePath,
          storyFile,
          csf,
          componentName,
          component,
          allComponents,
          subcomponents,
          docgenEngine,
          filterStoryIds: manifestEntryIds,
        })
    )
    .filter((component) => component !== undefined);

  // Start watching AFTER extraction — projects and TS programs are now populated,
  // so watchProgramSourceDirs() can discover all source file directories.
  if (manager && watch) {
    manager.startWatching();
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
      meta: {
        docgen: docgenEngine,
        durationMs,
      },
    },
  };
};
