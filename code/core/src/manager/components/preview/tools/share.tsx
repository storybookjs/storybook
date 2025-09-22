import React, { useMemo, useState } from 'react';

import { Button, TooltipLinkList, WithPopover, getStoryHref } from 'storybook/internal/components';
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
}: {
  baseUrl: string;
  storyId: string;
  queryParams: Record<string, any>;
  qrUrl: string;
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
              <QRTitle>Scan me</QRTitle>
              <QRDescription>Must be on the same network as this device.</QRDescription>
            </QRContent>
          </QRContainer>
        ),
      },
    ]);

    return baseLinks;
  }, [baseUrl, storyId, queryParams, copied, qrUrl, enableShortcuts, copyStoryLink]);

  return <TooltipLinkList links={links} />;
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
          const storyUrl = global.STORYBOOK_NETWORK_ADDRESS
            ? `${global.STORYBOOK_NETWORK_ADDRESS}${window.location.search}`
            : window.location.href;

          return storyId ? (
            <WithPopover
              hasChrome
              placement="bottom"
              popover={<ShareMenu {...{ baseUrl, storyId, queryParams, qrUrl: storyUrl }} />}
            >
              <Button padding="small" variant="ghost" ariaLabel="Share" tooltip="Share...">
                <ShareIcon />
              </Button>
            </WithPopover>
          ) : null;
        }}
      </Consumer>
    );
  },
};
