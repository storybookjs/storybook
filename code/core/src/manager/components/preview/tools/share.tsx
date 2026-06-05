import React from 'react';

import { Button, PopoverProvider } from 'storybook/internal/components';
import { QRCodeSVG } from 'qrcode.react';
import { SHARE_ISOLATE_MODE } from 'storybook/internal/core-events';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { PopOutIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

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

export const isolationModeTool: Addon_BaseType = {
  title: 'isolation mode',
  id: 'isolationMode',
  type: types.TOOLEXTRA,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) => {
        if (!storyId) return null;
        const originHrefs = api.getStoryHrefs(storyId, {
          base: 'origin',
          refId,
          inheritArgs: true,
        });
        return (
          <Button
            padding="small"
            variant="ghost"
            ariaLabel="Open in isolation mode"
            tooltip="Open in isolation mode"
            onClick={() => {
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
