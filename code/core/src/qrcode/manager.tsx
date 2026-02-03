import React, { useState } from 'react';

import { Button } from 'storybook/internal/components';

import { global } from '@storybook/global';

import copy from 'copy-to-clipboard';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { addons, types, useStorybookApi } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { ADDON_ID } from './constants';

const Container = styled.div(() => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: 24,
  maxWidth: 500,
  gap: 16,
}));

const Content = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: theme.typography.size.s1,
  color: theme.color.defaultText,
}));

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  lineHeight: '20px',
}));

const Description = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
}));

const ShareProviderRender = () => {
  const api = useStorybookApi();
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const { id: storyId, refId } = api.getCurrentStoryData() ?? {};
  if (!storyId) {
    return null;
  }

  const networkHrefs = api.getStoryHrefs(storyId, { base: 'network', refId });
  const shortcutKeys = api.getShortcutKeys();

  const copyLink = () => {
    copy(networkHrefs.managerHref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Container>
      <Content>
        <div>
          <Title>Copy link or scan QR code</Title>
          <Description>
            {global.CONFIG_TYPE === 'DEVELOPMENT'
              ? 'Must be on the same network as this device.'
              : 'View story on another device.'}
          </Description>
        </div>
        <Button
          ariaLabel="Copy link to clipboard"
          onClick={copyLink}
          shortcut={shortcutKeys?.copyStoryLink}
          padding="small"
          size="medium"
          variant="solid"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </Content>
      <QRCode
        value={networkHrefs.managerHref}
        marginSize={0}
        size={80}
        fgColor={theme.color.darkest}
        bgColor="transparent"
      />
    </Container>
  );
};

export default addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    type: types.experimental_SHARE_PROVIDER,
    title: 'Share',
    render: () => <ShareProviderRender />,
  });
});
