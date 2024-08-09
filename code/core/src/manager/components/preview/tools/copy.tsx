import React from 'react';

import { IconButton, getStoryHref } from '@storybook/core/components';
import type { Addon_BaseType } from '@storybook/core/types';
import { global } from '@storybook/global';
import { LinkIcon } from '@storybook/icons';

import { Consumer, types } from '@storybook/core/manager-api';
import type { Combo } from '@storybook/core/manager-api';

import copy from 'copy-to-clipboard';

const { PREVIEW_URL, document } = global;

const copyMapper = ({ state }: Combo) => {
  const { storyId, refId, refs } = state;
  const { location } = document;
  // @ts-expect-error (non strict)
  const ref = refs[refId];
  let baseUrl = `${location.origin}${location.pathname}`;
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  return {
    refId,
    baseUrl: ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || `${baseUrl}iframe.html`,
    storyId,
    queryParams: state.customQueryParams,
  };
};

export const copyTool: Addon_BaseType = {
  title: 'copy',
  id: 'copy',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={copyMapper}>
      {({ baseUrl, storyId, queryParams }) =>
        storyId ? (
          <IconButton
            key="copy"
            // @ts-expect-error (non strict)
            onClick={() => copy(getStoryHref(baseUrl, storyId, queryParams))}
            title="Copy canvas link"
          >
            <LinkIcon />
          </IconButton>
        ) : null
      }
    </Consumer>
  ),
};
