import type { Channel } from 'storybook/internal/channels';
import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
} from 'storybook/internal/common';
import type {
  FileComponentSearchRequestPayload,
  FileComponentSearchResponsePayload,
  RequestData,
  ResponseData,
} from 'storybook/internal/core-events';
import {
  FILE_COMPONENT_SEARCH_REQUEST,
  FILE_COMPONENT_SEARCH_RESPONSE,
} from 'storybook/internal/core-events';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options, SupportedRenderers } from 'storybook/internal/types';

import { type ComponentIndexEntry, createComponentIndex } from '../utils/component-file-indexer';

/** Transform component index entries back to the expected file response format */
function transformIndexEntriesToFileResponse(indexEntries: ComponentIndexEntry[]): Array<{
  filepath: string;
  exportedComponents: Array<{
    name: string;
    default: boolean;
  }> | null;
  storyFileExists: boolean;
}> {
  // Group entries by filepath
  const fileGroups = new Map<string, ComponentIndexEntry[]>();

  for (const entry of indexEntries) {
    if (!fileGroups.has(entry.filepath)) {
      fileGroups.set(entry.filepath, []);
    }
    fileGroups.get(entry.filepath)!.push(entry);
  }

  // Transform grouped entries back to file format
  return Array.from(fileGroups.entries()).map(([filepath, entries]) => ({
    filepath,
    exportedComponents: entries.map((entry) => ({
      name: entry.componentName,
      default: entry.isDefaultExport,
    })),
    storyFileExists: entries[0]?.storyFileExists ?? false,
  }));
}

export async function initFileSearchChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  /** Listens for a search query event and searches for files in the project */
  channel.on(
    FILE_COMPONENT_SEARCH_REQUEST,
    async (data: RequestData<FileComponentSearchRequestPayload>) => {
      const searchQuery = data.id;
      try {
        if (!searchQuery) {
          return;
        }

        const frameworkName = await getFrameworkName(options);
        const rendererName = (await extractProperRendererNameFromFramework(
          frameworkName
        )) as SupportedRenderers;

        // Create component index entries using the extracted logic
        const indexEntries = await createComponentIndex({
          searchQuery,
          rendererName,
        });

        // Transform index entries back to the expected format for the response
        const files = transformIndexEntriesToFileResponse(indexEntries);

        if (!coreOptions.disableTelemetry) {
          telemetry('create-new-story-file-search', {
            success: true,
            payload: {
              fileCount: files.length,
            },
          });
        }

        channel.emit(FILE_COMPONENT_SEARCH_RESPONSE, {
          success: true,
          id: searchQuery,
          payload: {
            files,
          },
          error: null,
        } satisfies ResponseData<FileComponentSearchResponsePayload>);
      } catch (e: any) {
        /** Emits the search result event with an error message */
        channel.emit(FILE_COMPONENT_SEARCH_RESPONSE, {
          success: false,
          id: searchQuery ?? '',
          error: `An error occurred while searching for components in the project.\n${e?.message}`,
        } satisfies ResponseData<FileComponentSearchResponsePayload>);

        if (!coreOptions.disableTelemetry) {
          telemetry('create-new-story-file-search', {
            success: false,
            error: `An error occured while searching for components: ${e}`,
          });
        }
      }
    }
  );

  return channel;
}
