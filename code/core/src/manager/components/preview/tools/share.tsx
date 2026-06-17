import React from 'react';

import { Button, PopoverProvider } from 'storybook/internal/components';
import { QRCodeSVG } from 'qrcode.react';
import { SHARE_ISOLATE_MODE } from 'storybook/internal/core-events';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { PopOutIcon, StarIcon as QRIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

const { document } = global;

const mapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

const QRContainer = styled.div(
  () =>
    ({
      display: 'flex',
      alignItems: 'center',
      padding: 12,
      width: 240,
      gap: 10,
    }) as const
);

const QRImageContainer = styled.div(() => ({
  width: 64,
  height: 64,
  padding: 2,
  borderRadius: 2,
  backgroundColor: 'white',
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
  marginBottom: 2,
}));

const QRDescription = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  textWrap: 'pretty',
}));

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

const QRToolContent = ({
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
  const currentUrl = document.location.href;

  if (!storyId) return null;

  return (
    <QRContainer>
      <QRImage value={currentUrl} />
      <QRContent>
        <QRTitle>Scan me</QRTitle>
        <QRDescription>View this story on another device.</QRDescription>
      </QRContent>
    </QRContainer>
  );
};

export const qrTool: Addon_BaseType = {
  title: 'qr',
  id: 'qr',
  type: types.TOOLEXTRA,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) => (
        <PopoverProvider
          ariaLabel="Story QR code"
          placement="bottom"
          padding="none"
          popover={({ onHide }) => (
            <QRToolContent api={api} storyId={storyId} refId={refId} onHide={onHide} />
          )}
        >
          <Button padding="small" variant="ghost" ariaLabel="Open story via QR code">
            <QRIcon />
          </Button>
        </PopoverProvider>
      )}
    </Consumer>
  ),
};
