import React from 'react';

import { global } from '@storybook/global';

import { QRCodeSVG as QRCode } from 'qrcode.react';
import { addons, types, useStorybookApi } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { ADDON_ID } from './constants';

const QRContainer = styled.div(() => ({
  display: 'flex',
  alignItems: 'center',
  padding: 8,
  maxWidth: 200,
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
      <QRCode value={value} marginSize={0} size={60} fgColor={theme.color.darkest} />
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

export default addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    type: types.experimental_SHARE_PROVIDER,
    render: () => {
      const api = useStorybookApi();
      const { id: storyId, refId } = api.getCurrentStoryData() ?? {};
      if (!storyId) {
        return null;
      }

      const networkHrefs = api.getStoryHrefs(storyId, { base: 'network', refId });
      return (
        <QRContainer>
          <QRImage value={networkHrefs.managerHref} />
          <QRContent>
            <QRTitle>Scan to open</QRTitle>
            <QRDescription>
              {global.CONFIG_TYPE === 'DEVELOPMENT'
                ? 'Device must be on the same network.'
                : 'View story on another device.'}
            </QRDescription>
          </QRContent>
        </QRContainer>
      );
    },
  });
});
