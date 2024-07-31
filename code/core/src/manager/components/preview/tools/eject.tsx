import { global } from '@storybook/global';
import React from 'react';
import { getStoryHref, IconButton } from '@storybook/core/components';
import { Consumer, types } from '@storybook/core/manager-api';
import type { Combo } from '@storybook/core/manager-api';
import type { Addon_BaseType } from '@storybook/core/types';
import { ShareAltIcon } from '@storybook/icons';

const { PREVIEW_URL } = global;

const ejectMapper = ({ state }: Combo) => {
  const { storyId, refId, refs } = state;
  // @ts-expect-error (non strict)
  const ref = refs[refId];

  return {
    refId,
    baseUrl: ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || 'iframe.html',
    storyId,
    queryParams: state.customQueryParams,
  };
};

export const ejectTool: Addon_BaseType = {
  title: 'eject',
  id: 'eject',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={ejectMapper}>
      {({ baseUrl, storyId, queryParams }) =>
        storyId ? (
          <IconButton key="opener" asChild>
            <a
              // @ts-expect-error (non strict)
              href={getStoryHref(baseUrl, storyId, queryParams)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open canvas in new tab"
            >
              <ShareAltIcon />
            </a>
          </IconButton>
        ) : null
      }
    </Consumer>
  ),
};
