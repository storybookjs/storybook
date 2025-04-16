import React, { useCallback, useState } from 'react';

import {
  IconButton,
  Modal,
  TooltipLinkList,
  WithTooltip,
  getStoryHref,
} from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { BookmarkHollowIcon, MarkupIcon, MobileIcon, ShareAltIcon } from '@storybook/icons';

import { QRCodeSVG } from 'qrcode.react';
import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const { PREVIEW_URL } = global;

const QRCodeContainer = styled.div(({ theme }) => ({
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
}));

const QRCodeTitle = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.textMutedColor,
  textAlign: 'center',
}));

const QRCodeWrapper = styled.div(({ theme }) => ({
  padding: '16px',
  backgroundColor: theme.color.lightest,
  borderRadius: theme.appBorderRadius,
}));

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

interface EjectButtonProps {
  storyId: string;
  baseUrl: string;
  queryParams: Record<string, string | undefined>;
}

export const EjectButton = ({ storyId, baseUrl, queryParams }: EjectButtonProps) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const isLocal = window.location.hostname === 'localhost';
  const origin = isLocal ? 'http://172.20.2.108:6006' : window.location.origin;

  const storyUrl = `${origin}/${getStoryHref(baseUrl, storyId, queryParams as Record<string, string>)}`;

  const handleCopyLink = useCallback(
    async (linkPath: string) => {
      const { createCopyToClipboardFunction } = await import('storybook/internal/components');
      await createCopyToClipboardFunction()(`${origin}${linkPath}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    },
    [origin]
  );

  return (
    <>
      <WithTooltip
        placement="top"
        closeOnOutsideClick
        tooltip={({ onHide }) => (
          <TooltipLinkList
            links={[
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
                  const href = getStoryHref(
                    baseUrl,
                    storyId,
                    queryParams as Record<string, string>
                  );
                  window.open(href, '_blank');
                  onHide();
                },
              },
              {
                id: 'device',
                title: 'Open on another device',
                icon: <MobileIcon />,
                onClick: () => {
                  setShowQRCode(true);
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

      <Modal open={showQRCode} onOpenChange={setShowQRCode}>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>Scan QR code with your device</Modal.Title>
          </Modal.Header>
          <QRCodeContainer>
            <QRCodeWrapper>
              <QRCodeSVG
                value={storyUrl}
                size={320}
                includeMargin
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </QRCodeWrapper>
            {isLocal && (
              <QRCodeTitle>
                You must be on the same network as this device to access this story.
              </QRCodeTitle>
            )}
          </QRCodeContainer>
        </Modal.Content>
      </Modal>
    </>
  );
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
          <EjectButton storyId={storyId} baseUrl={baseUrl} queryParams={queryParams} />
        ) : null
      }
    </Consumer>
  ),
};
