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
import type { CoreConfig, Options } from 'storybook/internal/types';

import { getNewStoryFile } from '../utils/get-new-story-file';

export function initCreateNewStoryChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  /** Listens for events to create a new storyfile */
  channel.on(
    CREATE_NEW_STORYFILE_REQUEST,
    async (data: RequestData<CreateNewStoryRequestPayload>) => {
      try {
        const { storyFilePath, exportedStoryName, storyFileContent } = await getNewStoryFile(
          data.payload,
          options
        );

        const relativeStoryFilePath = relative(process.cwd(), storyFilePath);

        const { storyId, kind } = await getStoryId({ storyFilePath, exportedStoryName }, options);

        if (existsSync(storyFilePath)) {
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

        await writeFile(storyFilePath, storyFileContent, 'utf-8');

        channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
          success: true,
          id: data.id,
          payload: {
            storyId,
            storyFilePath: relative(process.cwd(), storyFilePath),
            exportedStoryName,
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
