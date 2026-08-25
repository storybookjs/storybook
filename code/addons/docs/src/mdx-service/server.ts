import { getComponentIdFromEntry, groupBy, registerService } from 'storybook/internal/common';
import { type MdxPayload, Tag } from 'storybook/internal/core-server';
import type { DocsIndexEntry, StoryIndex } from 'storybook/internal/types';

import { createDocsManifestEntry } from '../manifest.ts';
import { mdxServiceDef } from './definition.ts';
import type { MdxProvider } from './types.ts';

export type RegisterMdxServiceOptions = {
  getIndex: () => Promise<StoryIndex>;
  provider?: MdxProvider;
};

function groupMdxEntriesByComponent(index: StoryIndex): Record<string, DocsIndexEntry[]> {
  return groupBy(
    Object.values(index.entries).filter(
      (entry): entry is DocsIndexEntry =>
        entry.type === 'docs' &&
        ((entry.tags?.includes(Tag.ATTACHED_MDX) ?? false) ||
          (entry.tags?.includes(Tag.UNATTACHED_MDX) ?? false))
    ),
    (entry) => (entry.tags?.includes(Tag.ATTACHED_MDX) ? getComponentIdFromEntry(entry) : entry.id)
  );
}

const defaultMdxProvider: MdxProvider = async ({ componentId, entries }) => {
  if (entries.length === 0) {
    return undefined;
  }

  const docs = await Promise.all(entries.map(createDocsManifestEntry));

  return {
    id: componentId,
    name: componentId,
    docs: Object.fromEntries(docs.map((doc) => [doc.id, doc])),
  } satisfies MdxPayload;
};

export function registerMdxService({
  getIndex,
  provider = defaultMdxProvider,
}: RegisterMdxServiceOptions) {
  return registerService(mdxServiceDef, {
    queries: {
      mdxForComponent: {
        staticInputs: async () => {
          const index = await getIndex();
          const grouped = groupMdxEntriesByComponent(index);

          return Object.keys(grouped).map((id) => ({ id }));
        },
      },
    },
    commands: {
      _extractMdxForComponent: {
        handler: async (input, ctx) => {
          const index = await getIndex();
          const grouped = groupMdxEntriesByComponent(index);
          const entries = grouped[input.id] ?? [];

          if (entries.length === 0) {
            return undefined;
          }

          const payload = await provider({
            componentId: input.id,
            entries,
          });

          if (!payload) {
            return undefined;
          }

          ctx.self.setState((state) => {
            state.components[input.id] = payload;
          });
          return payload;
        },
      },
      _extractAllMdx: {
        handler: async (_input, ctx) => {
          const index = await getIndex();
          const grouped = groupMdxEntriesByComponent(index);

          const extracted = await Promise.all(
            Object.entries(grouped).map(async ([id, entries]) => {
              const payload = await provider({ componentId: id, entries });
              return payload ? ([id, payload] as const) : undefined;
            })
          );

          ctx.self.setState((state) => {
            for (const result of extracted) {
              if (!result) {
                continue;
              }
              const [id, payload] = result;
              state.components[id] = payload;
            }
          });
        },
      },
    },
  });
}
