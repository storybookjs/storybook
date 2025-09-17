import {
  OPEN_IN_EDITOR_REQUEST,
  OPEN_IN_EDITOR_RESPONSE,
  type OpenInEditorResponsePayload,
} from 'storybook/internal/core-events';

import { addons } from './addons';

export async function openInEditor(
  file: string,
  line?: number,
  column?: number
): Promise<OpenInEditorResponsePayload> {
  return new Promise((resolve) => {
    const channel = addons.getChannel();
    const payload = { file, line, column };

    channel.on(OPEN_IN_EDITOR_RESPONSE, (payload: OpenInEditorResponsePayload) => {
      resolve(payload);
    });

    console.log('sending request');
    channel.emit(OPEN_IN_EDITOR_REQUEST, payload);
  });
}
