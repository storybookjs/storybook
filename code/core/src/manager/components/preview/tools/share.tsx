import React, { useMemo, useState } from 'react';

import {
  Button,
  PopoverProvider,
  TooltipLinkList,
  getStoryHref,
} from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { BugIcon, LinkIcon, ShareIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Consumer, types, useStorybookApi } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { Shortcut } from '../../../container/Menu';

const { PREVIEW_URL, document } = global as any;

const mapper = ({ state }: Combo) => {
  const { storyId, refId, refs } = state;
  const { location } = document;
  // @ts-expect-error (non strict)
  const ref = refs[refId];
  let baseUrl = `${location.origin}${location.pathname}`;

  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }

  return {
    refId,
    baseUrl: ref ? `${ref.url}/iframe.html` : (PREVIEW_URL as string) || `${baseUrl}iframe.html`,
    storyId,
    queryParams: state.customQueryParams,
  };
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

function ShareMenu({
  baseUrl,
  storyId,
  queryParams,
  qrUrl,
  isDevelopment,
}: {
  baseUrl: string;
  storyId: string;
  queryParams: Record<string, any>;
  qrUrl: string;
  isDevelopment: boolean;
}) {
  const api = useStorybookApi();
  const shortcutKeys = api.getShortcutKeys();
  const enableShortcuts = !!shortcutKeys;
  const [copied, setCopied] = useState(false);
  const copyStoryLink = shortcutKeys?.copyStoryLink;

  const links = useMemo(() => {
    const copyTitle = copied ? 'Copied!' : 'Copy story link';
    const baseLinks = [
      [
        {
          id: 'copy-link',
          title: copyTitle,
          icon: <LinkIcon />,
          right: enableShortcuts ? <Shortcut keys={copyStoryLink} /> : null,
          onClick: () => {
            copy(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
        },
        {
          id: 'open-new-tab',
          title: 'Open in isolation mode',
          icon: <BugIcon />,
          onClick: () => {
            const href = getStoryHref(baseUrl, storyId, queryParams);
            window.open(href, '_blank', 'noopener,noreferrer');
          },
        },
      ],
    ];

    baseLinks.push([
      {
        id: 'qr-section',
        // @ts-expect-error (non strict)
        content: (
          <QRContainer>
            <QRImage value={qrUrl} />
            <QRContent>
              <QRTitle>Scan to open</QRTitle>
              <QRDescription>
                {isDevelopment
                  ? 'Device must be on the same network.'
                  : 'View story on another device.'}
              </QRDescription>
            </QRContent>
          </QRContainer>
        ),
      },
    ]);

    return baseLinks;
  }, [baseUrl, storyId, queryParams, copied, qrUrl, enableShortcuts, copyStoryLink, isDevelopment]);

  return <TooltipLinkList links={links} style={{ width: 210 }} />;
}

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => {
    return (
      <Consumer filter={mapper}>
        {({ baseUrl, storyId, queryParams }) => {
          const isDevelopment = global.CONFIG_TYPE === 'DEVELOPMENT';
          const storyUrl = global.STORYBOOK_NETWORK_ADDRESS
            ? new URL(window.location.search, global.STORYBOOK_NETWORK_ADDRESS).href
            : window.location.href;

          return storyId ? (
            <PopoverProvider
              hasChrome
              placement="bottom"
              padding={0}
              popover={
                <ShareMenu {...{ baseUrl, storyId, queryParams, qrUrl: storyUrl, isDevelopment }} />
              }
            >
              <Button padding="small" variant="ghost" ariaLabel="Share" tooltip="Share...">
                <ShareIcon />
              </Button>
            </PopoverProvider>
          ) : null;
        }}
      </Consumer>
    );
  },
};
