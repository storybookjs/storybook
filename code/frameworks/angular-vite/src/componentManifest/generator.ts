import path from 'node:path';
import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from 'storybook/internal/common';
import type {
  IndexEntry,
  Manifests,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';
import { buildAngularComponentManifest } from './buildAngularComponentManifest.ts';
import { getCompodocDocumentation, invalidateCompodocCache } from './compodocExtractor.ts';
import { resolveAngularStoryComponent } from './resolveAngularComponents.ts';
import { invalidateCache } from './utils.ts';

export const manifest: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const { manifestEntries } = options;

  invalidateCache();
  invalidateCompodocCache();

  const startTime = performance.now();

  const cwd = process.cwd();
  const compodocJson = getCompodocDocumentation({ cwd });

  const entriesByUniqueComponent = [
    ...selectComponentEntriesByComponentId(manifestEntries).values(),
  ];

  const manifestEntryIds = new Set(manifestEntries.map((entry) => entry.id));

  const components = (
    await Promise.all(
      entriesByUniqueComponent.map(async (entry) => {
        const storyFilePath = getStoryImportPathFromEntry(entry);
        if (!storyFilePath) {
          return undefined;
        }

        const storyPath = path.join(cwd, storyFilePath);

        const resolved = await resolveAngularStoryComponent({
          storyPath,
          title: entry.title,
        });

        return buildAngularComponentManifest({
          entry,
          storyFilePath,
          compodocJson,
          filterStoryIds: manifestEntryIds,
          ...resolved,
        });
      })
    )
  ).filter((c): c is NonNullable<typeof c> => c !== undefined);

  const durationMs = Math.round(performance.now() - startTime);

  console.info(
    `[angular:manifest] Built Angular component manifest for ${components.length} components in ${durationMs}ms.`
  );

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      meta: {
        docgen: 'compodoc',
        durationMs,
      },
    },
  } as unknown as Manifests;
};
