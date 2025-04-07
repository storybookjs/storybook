import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { getStoryId } from 'storybook/internal/common';
import type {
  CreateNewStoryErrorPayload,
  CreateNewStoryRequestPayload,
  CreateNewStoryResponsePayload,
  RequestData,
  ResponseData,
} from 'storybook/internal/core-events';
import {
  CREATE_NEW_STORYFILE_REQUEST,
  CREATE_NEW_STORYFILE_RESPONSE,
} from 'storybook/internal/core-events';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Indexer, Options } from 'storybook/internal/types';

const DEFAULT_NEW_STORY_NAME = 'Default';

export function initCreateNewStoryChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig,
  indexers: Indexer[]
) {
  /** Listens for events to create a new storyfile */
  channel.on(
    CREATE_NEW_STORYFILE_REQUEST,
    async (data: RequestData<CreateNewStoryRequestPayload>) => {
      try {
        const indexer = indexers.find((ind) =>
          ind.createNewStoryFile?.test.exec(data.payload.componentFilePath)
        );

        if (!indexer) {
          throw new Error(`No indexer found for ${data.payload.componentFilePath}`);
        }

        const { newStoryFilePath, code } = await indexer.createNewStoryFile!.create(
          { ...data.payload, newStoryName: DEFAULT_NEW_STORY_NAME },
          options
        );

        const relativeStoryFilePath = relative(process.cwd(), newStoryFilePath);

        const { storyId, kind } = await getStoryId(
          { storyFilePath: newStoryFilePath, exportedStoryName: DEFAULT_NEW_STORY_NAME },
          options
        );

        if (existsSync(newStoryFilePath)) {
          channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
            success: false,
            id: data.id,
            payload: {
              type: 'STORY_FILE_EXISTS',
              kind,
            },
            error: `A story file already exists at ${relativeStoryFilePath}`,
          } satisfies ResponseData<CreateNewStoryResponsePayload, CreateNewStoryErrorPayload>);

          if (!coreOptions.disableTelemetry) {
            telemetry('create-new-story-file', {
              success: false,
              error: 'STORY_FILE_EXISTS',
            });
          }

          return;
        }

        await writeFile(newStoryFilePath, code, 'utf-8');

        channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
          success: true,
          id: data.id,
          payload: {
            storyId,
            storyFilePath: relative(process.cwd(), newStoryFilePath),
            exportedStoryName: DEFAULT_NEW_STORY_NAME,
          },
          error: null,
        } satisfies ResponseData<CreateNewStoryResponsePayload>);

        if (!coreOptions.disableTelemetry) {
          telemetry('create-new-story-file', {
            success: true,
          });
        }
      } catch (e: any) {
        channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
          success: false,
          id: data.id,
          error: e?.message,
        } satisfies ResponseData<CreateNewStoryResponsePayload>);

        if (!coreOptions.disableTelemetry) {
          await telemetry('create-new-story-file', {
            success: false,
            error: e,
          });
        }
      }
    }
  );

  return channel;
}
