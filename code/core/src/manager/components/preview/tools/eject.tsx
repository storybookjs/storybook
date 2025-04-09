import React, { useCallback, useState } from 'react';

import {
  IconButton,
  TooltipLinkList,
  WithTooltip,
  getStoryHref,
} from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { BookmarkHollowIcon, MarkupIcon, MobileIcon, ShareAltIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const { PREVIEW_URL } = global;

const ejectMapper = ({ state, api }: Combo) => {
  const { storyId, refId, refs } = state;
  // @ts-expect-error (non strict)
  const ref = refs[refId];

  const data = api.getCurrentStoryData();

  return {
    storyFileName: data?.parameters?.fileName,
    refId,
    baseUrl: ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || 'iframe.html',
    storyId,
    queryParams: state.customQueryParams,
  };
};

interface EjectButtonProps {
  storyId: string;
  baseUrl: string;
  queryParams: Record<string, string | undefined>;
  storyFileName: string;
}

export const EjectButton = ({ storyId, baseUrl, queryParams, storyFileName }: EjectButtonProps) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = useCallback(async (linkPath: string) => {
    const { createCopyToClipboardFunction } = await import('storybook/internal/components');
    await createCopyToClipboardFunction()(`${window.location.origin}${linkPath}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, []);

  const handleOpenInEditorLink = useCallback(async () => {
    await fetch(`/__open-in-editor?file=${storyFileName}`);
  }, [storyFileName]);

  return (
    <WithTooltip
      placement="top"
      closeOnOutsideClick
      tooltip={({ onHide }) => (
        <TooltipLinkList
          links={[
            {
              id: 'editor',
              title: 'Open in Editor',
              icon: <MarkupIcon />,
              right: '⌥⇧E',
              onClick: () => {
                handleOpenInEditorLink();
                onHide();
              },
            },
            {
              id: 'copy',
              title: isCopied ? 'Copied!' : 'Copy story link',
              icon: <BookmarkHollowIcon />,
              right: '⌘⇧C',
              onClick: () => {
                handleCopyLink(
                  getStoryHref(baseUrl, storyId, queryParams as Record<string, string>)
                );
              },
            },
            {
              id: 'isolated',
              title: 'Open in isolated mode',
              icon: <ShareAltIcon />,
              onClick: () => {
                const href = getStoryHref(baseUrl, storyId, queryParams as Record<string, string>);
                window.open(href, '_blank');
                onHide();
              },
            },
            {
              id: 'device',
              title: 'Open on another device',
              icon: <MobileIcon />,
              onClick: () => {
                // TODO: Implement device mode functionality
                onHide();
              },
            },
          ]}
        />
      )}
      onVisibleChange={setIsTooltipVisible}
    >
      <IconButton key="opener" title="Open canvas in new tab" active={isTooltipVisible}>
        <ShareAltIcon />
      </IconButton>
    </WithTooltip>
  );
};

export const ejectTool: Addon_BaseType = {
  title: 'eject',
  id: 'eject',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={ejectMapper}>
      {({ baseUrl, storyId, queryParams, storyFileName }) =>
        storyId ? (
          <EjectButton
            storyId={storyId}
            baseUrl={baseUrl}
            queryParams={queryParams}
            storyFileName={storyFileName}
          />
        ) : null
      }
    </Consumer>
  ),
};
