import React, { useEffect, useMemo, useState } from 'react';

import { Button, PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import {
  SHARE_ISOLATE_MODE,
  SHARE_POPOVER_OPENED,
  SHARE_STORY_LINK,
} from 'storybook/internal/core-events';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { LinkIcon, ShareAltIcon, ShareIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Consumer, types } from 'storybook/manager-api';
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
  const [copied, setCopied] = useState(false);
  const copyStoryLink = shortcutKeys?.copyStoryLink;
  const openInIsolation = shortcutKeys?.openInIsolation;

  useEffect(() => {
    api.emit(SHARE_POPOVER_OPENED);
  }, [api]);

  const links = useMemo(() => {
    const copyTitle = copied ? 'Copied!' : 'Copy story link';
    const originHrefs = api.getStoryHrefs(storyId, { base: 'origin', refId });
    const networkHrefs = api.getStoryHrefs(storyId, { base: 'network', refId });

    return [
      [
        {
          id: 'copy-link',
          title: copyTitle,
          icon: <LinkIcon />,
          right: enableShortcuts ? <Shortcut keys={copyStoryLink} /> : null,
          onClick: () => {
            api.emit(SHARE_STORY_LINK, originHrefs.managerHref);
            copy(originHrefs.managerHref);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
        },
        {
          id: 'open-new-tab',
          title: 'Open in isolation mode',
          icon: <ShareAltIcon />,
          right: enableShortcuts ? <Shortcut keys={openInIsolation} /> : null,
          onClick: () => {
            api.emit(SHARE_ISOLATE_MODE, originHrefs.previewHref);
          },
          href: originHrefs.previewHref,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      ],
      [
        {
          id: 'qr-section',
          content: (
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
          ),
        },
      ],
    ];
  }, [api, storyId, refId, copied, enableShortcuts, copyStoryLink, openInIsolation]);

  return <TooltipLinkList links={links} style={{ width: 240 }} />;
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
