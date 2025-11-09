import React from 'react';

import { IconButton } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { EditorIcon } from '@storybook/icons';

import { Consumer, types, useStorybookApi } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const mapper = ({ state, api }: Combo) => {
  const { storyId, refId } = state;
  const entry = api.getData(storyId, refId);

  const isCompositionStory = !!refId; // Only allow opening local stories in editor

  return {
    storyId,
    isCompositionStory,
    importPath: entry?.importPath as string | undefined,
  };
};

export const openInEditorTool: Addon_BaseType = {
  title: 'open-in-editor',
  id: 'open-in-editor',
  type: types.TOOL,
  match: ({ viewMode, tabId }) =>
    global.CONFIG_TYPE === 'DEVELOPMENT' && (viewMode === 'story' || viewMode === 'docs') && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ importPath, isCompositionStory }) => {
        const api = useStorybookApi();
        if (isCompositionStory || !importPath) {
          return null;
        }
        return (
          <IconButton
            key="open-in-editor"
            onClick={() =>
              api.openInEditor({
                file: importPath,
              })
            }
            title="Open in editor"
            aria-label="Open in editor"
          >
            <EditorIcon />
          </IconButton>
        );
      }}
    </Consumer>
  ),
};
