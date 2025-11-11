import type { Channel } from 'storybook/internal/channels';
import type {
  OpenInEditorRequestPayload,
  OpenInEditorResponsePayload,
} from 'storybook/internal/core-events';
import { OPEN_IN_EDITOR_REQUEST, OPEN_IN_EDITOR_RESPONSE } from 'storybook/internal/core-events';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import launch from 'launch-editor';

export async function initOpenInEditorChannel(
  channel: Channel,
  _options: Options,
  coreOptions: CoreConfig
) {
  channel.on(OPEN_IN_EDITOR_REQUEST, async (payload: OpenInEditorRequestPayload) => {
    const sendTelemetry = (data: { success: boolean; error?: string }) => {
      if (!coreOptions.disableTelemetry) {
        telemetry('open-in-editor', data);
      }
    };
    try {
      const { file: targetFile, line, column } = payload;

      if (!targetFile) {
        throw new Error('No file was provided to open');
      }

      const location =
        typeof line === 'number'
          ? `${targetFile}:${line}${typeof column === 'number' ? `:${column}` : ''}`
          : targetFile;

      await new Promise<void>((resolve, reject) => {
        launch(location, undefined, (_fileName: string, errorMessage: string | null) => {
          if (errorMessage) {
            reject(new Error(errorMessage));
          } else {
            resolve();
          }
        });
      });

      channel.emit(OPEN_IN_EDITOR_RESPONSE, {
        file: targetFile!,
        line,
        column,
        error: null,
      } satisfies OpenInEditorResponsePayload);

      sendTelemetry({ success: true });
    } catch (e: any) {
      const error = e?.message || 'Failed to open in editor';
      channel.emit(OPEN_IN_EDITOR_RESPONSE, {
        error,
        ...payload,
      } satisfies OpenInEditorResponsePayload);

      sendTelemetry({ success: false, error });
    }
  });

  return channel;
}
