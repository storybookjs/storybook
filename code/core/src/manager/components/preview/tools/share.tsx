import React, { useMemo, useState } from 'react';

import {
  IconButton,
  TooltipLinkList,
  WithTooltip,
  getStoryHref,
} from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { ShareAltIcon as BugIcon, LinkIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
// @ts-expect-error see https://github.com/rosskhanas/react-qr-code/issues/251
import { QRCode } from 'react-qr-code';
import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

const { PREVIEW_URL, document, STORYBOOK_NETWORK_ADDRESS } = global as any;

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
    value && (
      <QRImageContainer>
        <QRCode value={value} size={58} fgColor={theme.color.darkest} />
      </QRImageContainer>
    )
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
  qrUrl?: string;
}) {
  // const api = useStorybookApi();
  // const shortcutKeys = api.getShortcutKeys();
  // const enableShortcuts = !!shortcutKeys;
  const [copied, setCopied] = useState(false);

  const links = useMemo(() => {
    const copyTitle = copied ? 'Copied!' : 'Copy story link';
    const baseLinks = [
      [
        {
          id: 'copy-link',
          title: copyTitle,
          icon: <LinkIcon />,
          // right: enableShortcuts ? <Shortcut keys={['meta', 'shift', 'c']} /> : null,
          onClick: () => {
            copy(getStoryHref(baseUrl, storyId, queryParams));
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

    if (qrUrl) {
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
    }

    return baseLinks;
  }, [baseUrl, storyId, queryParams, copied, qrUrl]);

  return <TooltipLinkList links={links} />;
}

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => {
    const externalUrl = (STORYBOOK_NETWORK_ADDRESS as string | undefined) ?? undefined;
    return (
      <Consumer filter={mapper}>
        {({ baseUrl, storyId, queryParams }) =>
          storyId ? (
            <WithTooltip
              hasChrome
              placement="bottom"
              tooltip={<ShareMenu {...{ baseUrl, storyId, queryParams, qrUrl: externalUrl }} />}
            >
              <IconButton title="Share">
                <BugIcon />
              </IconButton>
            </WithTooltip>
          ) : null
        }
      </Consumer>
    );
  },
};
