import React, { useCallback, useEffect, useState } from 'react';

import { Button, PopoverProvider } from 'storybook/internal/components';
import { QRCodeSVG } from 'qrcode.react';
import { SHARE_ISOLATE_MODE } from 'storybook/internal/core-events';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CopyIcon, PopOutIcon, ShareIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

const { document: doc, window: globalWindow } = global;

const mapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

const QRContainer = styled.div(
  () =>
    ({
      display: 'flex',
      flexDirection: 'column',
      padding: 8,
      width: 300,
      maxWidth: 300,
      gap: 8,
    }) as const
);

const QRRow = styled.div(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const ShareLinkInput = styled.input(({ theme }) => ({
  width: '100%',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: theme.typography.size.s1,
  color: theme.color.defaultText,
  backgroundColor: theme.background.app,
  outline: 'none',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  '&:focus': {
    borderColor: theme.color.secondary,
  },
}));

const QRImageContainer = styled.div(() => ({
  width: 64,
  height: 64,
  marginRight: 12,
  backgroundColor: 'white',
  padding: 2,
}));

const QRImage = ({ value }: { value: string }) => {
  const theme = useTheme();
  return (
    <QRImageContainer>
      <QRCodeSVG value={value} marginSize={0} size={60} fgColor={theme.color.darkest} />
    </QRImageContainer>
  );
};

const QRContent = styled.div(() => ({}));

const QRTitle = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1,
  marginBottom: 4,
}));

const QRDescription = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.textMutedColor,
}));

const CopyButton = styled(Button)({
  flexShrink: 0,
});

const IsolationButton = styled(Button)({
  width: '100%',
});

export const isolationModeTool: Addon_BaseType = {
  title: 'isolation mode',
  id: 'isolationMode',
  type: types.TOOLEXTRA,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) => {
        if (!storyId) return null;
        return (
          <Button
            padding="small"
            variant="ghost"
            ariaLabel="Open in isolation mode"
            tooltip="Open in isolation mode"
            onClick={() => {
              const originHrefs = api.getStoryHrefs(storyId, {
                base: 'origin',
                refId,
                inheritArgs: true,
              });
              window.open(originHrefs.previewHref, '_blank', 'noopener,noreferrer');
              api.emit(SHARE_ISOLATE_MODE, originHrefs.previewHref);
            }}
          >
            <PopOutIcon />
          </Button>
        );
      }}
    </Consumer>
  ),
};

function useCopyToClipboard(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await globalWindow.navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const textarea = doc?.createElement('textarea');
        if (!textarea) return;
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        doc?.body?.appendChild(textarea);
        textarea.select();
        doc?.execCommand('copy');
        doc?.body?.removeChild(textarea);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
  }, []);

  useEffect(() => {
    if (copied) {
      const id = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(id);
    }
  }, [copied]);

  return [copied, copy];
}

const ShareToolContent = ({
  api,
  storyId,
  refId,
  onHide,
}: {
  api: Combo['api'];
  storyId: string;
  refId?: string;
  onHide?: () => void;
}) => {
  const [copied, copyToClipboard] = useCopyToClipboard();
  const currentUrl = doc?.location?.href || '';

  const handleCopy = useCallback(() => {
    copyToClipboard(currentUrl);
  }, [copyToClipboard, currentUrl]);

  if (!storyId) return null;

  const originHrefs = api.getStoryHrefs(storyId, { base: 'origin', refId });

  const handleOpenIsolation = useCallback(() => {
    window.open(originHrefs.previewHref, '_blank', 'noopener,noreferrer');
    api.emit(SHARE_ISOLATE_MODE, originHrefs.previewHref);
    onHide?.();
  }, [api, originHrefs, onHide]);

  return (
    <QRContainer>
      <QRRow>
        <QRImage value={currentUrl} />
        <QRContent>
          <QRTitle>Share this story</QRTitle>
          <QRDescription>Copy the link to share</QRDescription>
        </QRContent>
      </QRRow>
      <QRRow>
        <ShareLinkInput
          readOnly
          value={currentUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          aria-label="Story URL"
        />
        <CopyButton
          padding="small"
          variant="ghost"
          ariaLabel={copied ? 'Copied' : 'Copy link'}
          tooltip={copied ? 'Copied!' : 'Copy link'}
          onClick={handleCopy}
        >
          <CopyIcon />
        </CopyButton>
      </QRRow>
      <IsolationButton
        padding="small"
        variant="ghost"
        ariaLabel="Open in isolation mode"
        tooltip="Open this story in a new tab without the Storybook UI"
        onClick={handleOpenIsolation}
      >
        <PopOutIcon /> Open in isolation
      </IsolationButton>
    </QRContainer>
  );
};

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOLEXTRA,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) => (
        <PopoverProvider
          ariaLabel="Share story"
          placement="bottom"
          padding="none"
          popover={({ onHide }) => (
            <ShareToolContent api={api} storyId={storyId} refId={refId} onHide={onHide} />
          )}
        >
          <Button padding="small" variant="ghost" ariaLabel="Share story" tooltip="Share story">
            <ShareIcon />
          </Button>
        </PopoverProvider>
      )}
    </Consumer>
  ),
};
