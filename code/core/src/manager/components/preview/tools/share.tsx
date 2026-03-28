import React, { useEffect } from 'react';

import { ActionList, Button, PopoverProvider } from 'storybook/internal/components';
import { SHARE_ISOLATE_MODE, SHARE_POPOVER_OPENED } from 'storybook/internal/core-events';
import type { Addon_BaseType, Addon_ShareSectionType } from 'storybook/internal/types';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { ShareAltIcon, ShareIcon } from '@storybook/icons';

import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Consumer, addons, types } from 'storybook/manager-api';
import type { API, Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { Shortcut } from '../../Shortcut';

const mapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

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

const ShareSectionWrapper = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const ShareMenu = React.memo(function ShareMenu({
  api,
  storyId,
  refId,
}: {
  api: API;
  storyId: string;
  refId: string | undefined;
}) {
  const shortcutKeys = api.getShortcutKeys();
  const enableShortcuts = !!shortcutKeys;
  const openInIsolation = shortcutKeys?.openInIsolation;

  useEffect(() => {
    api.emit(SHARE_POPOVER_OPENED);
  }, [api]);

  const originHrefs = api.getStoryHrefs(storyId, { base: 'origin', refId });
  const networkHrefs = api.getStoryHrefs(storyId, { base: 'network', refId });

  const shareSections = addons.getElements(Addon_TypesEnum.experimental_SHARE_SECTION) as Record<
    string,
    Addon_ShareSectionType
  >;
  const ShareSection = Object.values(shareSections)[0]?.render ?? null;

  return (
    <div style={{ width: 240 }}>
      {ShareSection && (
        <ShareSectionWrapper>
          <ShareSection storyId={storyId} api={api} />
        </ShareSectionWrapper>
      )}
      <ActionList>
        <ActionList.Item>
          <ActionList.Link
            href={originHrefs.previewHref}
            target="_blank"
            rel="noopener noreferrer"
            ariaLabel="Open in isolation mode"
            onClick={() => api.emit(SHARE_ISOLATE_MODE, originHrefs.previewHref)}
          >
            <ActionList.Icon>
              <ShareAltIcon />
            </ActionList.Icon>
            <ActionList.Text>Open in isolation mode</ActionList.Text>
            {enableShortcuts && <Shortcut keys={openInIsolation} />}
          </ActionList.Link>
        </ActionList.Item>
      </ActionList>
      <ActionList>
        <ActionList.Item>
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
        </ActionList.Item>
      </ActionList>
    </div>
  );
});

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) =>
        storyId ? (
          <PopoverProvider
            ariaLabel="Share this story"
            hasChrome
            placement="bottom"
            padding={0}
            popover={<ShareMenu {...{ api, storyId, refId }} />}
          >
            <Button padding="small" variant="ghost" ariaLabel="Share" tooltip="Share...">
              <ShareIcon />
            </Button>
          </PopoverProvider>
        ) : null
      }
    </Consumer>
  ),
};
