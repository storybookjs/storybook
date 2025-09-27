import React from 'react';

import {
  OPEN_IN_EDITOR_REQUEST,
  OPEN_IN_EDITOR_RESPONSE,
  type OpenInEditorResponsePayload,
} from 'storybook/internal/core-events';
import type { API_Notification } from 'storybook/internal/types';

import { FailedIcon } from '@storybook/icons';

import type { ModuleFn } from '../lib/types';

export interface SubState {
  notifications: API_Notification[];
}

/** The API for opening files in the editor. */
export interface SubAPI {
  /**
   * Opens the file in the editor. You can optionally provide a line and column number to open at a
   * more specific location.
   */
  openInEditor: (payload: {
    file: string;
    line?: number;
    column?: number;
  }) => Promise<OpenInEditorResponsePayload>;
}

export const init: ModuleFn = ({ provider, fullAPI }) => {
  const api: SubAPI = {
    openInEditor(payload: {
      file: string;
      line?: number;
      column?: number;
    }): Promise<OpenInEditorResponsePayload> {
      return new Promise((resolve) => {
        const { file, line, column } = payload;
        const handler = (res: OpenInEditorResponsePayload) => {
          if (res.file === file && res.line === line && res.column === column) {
            provider.channel?.off(OPEN_IN_EDITOR_RESPONSE, handler);
            resolve(res);
          }
        };
        provider.channel?.on(OPEN_IN_EDITOR_RESPONSE, handler);
        provider.channel?.emit(OPEN_IN_EDITOR_REQUEST, payload);
      });
    },
  };

  const state: SubState = { notifications: [] };

  return {
    api,
    state,
    init: async () => {
      const { color } = await import('../../theming');
      provider.channel?.on(OPEN_IN_EDITOR_RESPONSE, (payload: OpenInEditorResponsePayload) => {
        if (payload.error !== null) {
          fullAPI.addNotification({
            id: 'open-in-editor-error',
            content: {
              headline: 'Failed to open in editor',
              subHeadline:
                payload.error ||
                'Check the Storybook process on the command line for more details.',
            },
            icon: <FailedIcon color={color.negative} />,
            duration: 8_000,
          });
        }
      });
    },
  };
};
