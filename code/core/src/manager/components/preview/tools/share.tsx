import React, { useMemo, useState } from 'react';

import { Button, PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import { type Addon_BaseType, Addon_TypesEnum } from 'storybook/internal/types';

import { LinkIcon, ShareAltIcon, ShareIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
import { Consumer, types } from 'storybook/manager-api';
import type { API, Combo } from 'storybook/manager-api';

import { Shortcut } from '../../Shortcut';

const mapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

interface ShareMenuProps {
  api: API;
  storyId: string;
  refId: string | undefined;
}

const ShareMenu = React.memo(function ShareMenu({ api, storyId, refId }: ShareMenuProps) {
  const shortcutKeys = api.getShortcutKeys();
  const enableShortcuts = !!shortcutKeys;
  const [copied, setCopied] = useState(false);
  const copyStoryLink = shortcutKeys?.copyStoryLink;
  const openInIsolation = shortcutKeys?.openInIsolation;

  const links = useMemo(() => {
    const copyTitle = copied ? 'Copied!' : 'Copy story link';
    const originHrefs = api.getStoryHrefs(storyId, { base: 'origin', refId });
    const registeredShareProviders = api.getElements(Addon_TypesEnum.experimental_SHARE_PROVIDER);

    return [
      [
        {
          id: 'copy-link',
          title: copyTitle,
          icon: <LinkIcon />,
          right: enableShortcuts ? <Shortcut keys={copyStoryLink} /> : null,
          onClick: () => {
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
          href: originHrefs.previewHref,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      ],
      Object.values(registeredShareProviders).map((registeredShareProvider) => {
        const { shareMenu, id } = registeredShareProvider;
        return { id, content: shareMenu() };
      }),
    ].filter(Boolean);
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
