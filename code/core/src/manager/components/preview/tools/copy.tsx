import React, { useCallback } from 'react';

import { IconButton, getStoryHref } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { MarkupIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const { PREVIEW_URL, document } = global;

const copyMapper = ({ state, api }: Combo) => {
  const { storyId, refId, refs } = state;
  const { location } = document;
  // @ts-expect-error (non strict)
  const ref = refs[refId];
  let baseUrl = `${location.origin}${location.pathname}`;

  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }

  const data = api.getCurrentStoryData();

  return {
    storyFileName: data?.parameters?.fileName,
    refId,
    baseUrl: ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || `${baseUrl}iframe.html`,
    storyId,
    queryParams: state.customQueryParams,
  };
};

const OpenInEditorButton = ({
  baseUrl,
  storyId,
  queryParams,
  storyFileName,
}: {
  baseUrl: string;
  storyId: string;
  queryParams: Record<string, string>;
  storyFileName: string;
}) => {
  const handleOpenInEditorLink = useCallback(async () => {
    await fetch(`/__open-in-editor?file=${storyFileName}`);
  }, [storyFileName]);

  return (
    <IconButton
      key="copy"
      // @ts-expect-error (non strict)
      onClick={() => copy(getStoryHref(baseUrl, storyId, queryParams))}
      title="Copy canvas link"
    >
      <MarkupIcon />
    </IconButton>
  );
};

export const copyTool: Addon_BaseType = {
  title: 'copy',
  id: 'copy',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={copyMapper}>
      {({ baseUrl, storyId, queryParams, storyFileName }) =>
        storyId ? (
          <OpenInEditorButton
            baseUrl={baseUrl}
            storyId={storyId}
            queryParams={queryParams}
            storyFileName={storyFileName}
          />
        ) : null
      }
    </Consumer>
  ),
};
