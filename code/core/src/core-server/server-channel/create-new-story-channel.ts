import type { Channel } from 'storybook/internal/channels';
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

import { generateStoryFile } from '../utils/generate-story';

export function initCreateNewStoryChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  /** Listens for events to create a new storyfile */
  channel.on(
    CREATE_NEW_STORYFILE_REQUEST,
    async (data: RequestData<CreateNewStoryRequestPayload>) => {
      const result = await generateStoryFile(data.payload, options);

      if (result.success) {
        channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
          success: true,
          id: data.id,
          payload: {
            storyId: result.storyId!,
            storyFilePath: result.storyFilePath!,
            exportedStoryName: result.exportedStoryName!,
            alreadyContainsArgs: result.alreadyContainsArgs!,
          },
          error: null,
        } satisfies ResponseData<CreateNewStoryResponsePayload>);

        if (!coreOptions.disableTelemetry) {
          telemetry('create-new-story-file', {
            success: true,
          });
        }
      } else {
        channel.emit(CREATE_NEW_STORYFILE_RESPONSE, {
          success: false,
          id: data.id,
          payload:
            result.errorType === 'STORY_FILE_EXISTS'
              ? {
                  type: 'STORY_FILE_EXISTS',
                  kind: result.kind!,
                }
              : undefined,
          error: result.error || 'Unknown error occurred',
        } satisfies ResponseData<CreateNewStoryResponsePayload, CreateNewStoryErrorPayload>);

        if (!coreOptions.disableTelemetry) {
          await telemetry('create-new-story-file', {
            success: false,
            error: result.errorType || result.error,
          });
        }
      }
    }
  );

  return channel;
}
