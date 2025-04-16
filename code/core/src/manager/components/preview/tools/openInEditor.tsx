import React, { useCallback } from 'react';

import { IconButton } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { MarkupIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const openInEditorMapper = ({ state, api }: Combo) => {
  const { storyId } = state;
  const data = api.getCurrentStoryData();

  return {
    storyFileName: data?.parameters?.fileName,
    storyId,
  };
};

const OpenInEditorButton = ({ storyFileName }: { storyFileName: string }) => {
  const handleOpenInEditorLink = useCallback(async () => {
    await fetch(`/__open-in-editor?file=${storyFileName}`);
  }, [storyFileName]);

  return (
    <IconButton key="copy" onClick={handleOpenInEditorLink} title="Copy canvas link">
      <MarkupIcon />
    </IconButton>
  );
};

export const openInEditorTool: Addon_BaseType = {
  title: 'openInEditor',
  id: 'openInEditor',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={openInEditorMapper}>
      {({ storyFileName }) =>
        storyFileName ? <OpenInEditorButton storyFileName={storyFileName} /> : null
      }
    </Consumer>
  ),
};
