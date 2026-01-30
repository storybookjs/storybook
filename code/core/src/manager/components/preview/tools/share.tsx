import React, { useMemo } from 'react';

import { Button, PopoverProvider, TabsView } from 'storybook/internal/components';
import { type Addon_BaseType, Addon_TypesEnum } from 'storybook/internal/types';

import { ShareAltIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { API, Combo } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const ShareProviderTabs = styled(TabsView)({
  minWidth: 400,
});

const ShareDialog = ({ api }: { api: API }) => {
  const tabs = useMemo(() => {
    const registeredShareProviders = api.getElements(Addon_TypesEnum.experimental_SHARE_PROVIDER);

    return Object.values(registeredShareProviders).map((registeredShareProvider) => {
      const { id, title, render } = registeredShareProvider;
      return { id, title, children: render };
    });
  }, [api]);

  return <ShareProviderTabs tabs={tabs} backgroundColor="transparent" />;
};

const mapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={mapper}>
      {({ api, storyId, refId }) =>
        storyId ? (
          <>
            <Button
              padding="small"
              variant="ghost"
              ariaLabel="Open in isolation mode"
              asChild
              shortcut={api.getShortcutKeys()?.openInIsolation}
            >
              <a
                href={api.getStoryHrefs(storyId, { base: 'origin', refId }).previewHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShareAltIcon />
              </a>
            </Button>
            <PopoverProvider
              hasChrome
              placement="bottom"
              padding={0}
              popover={<ShareDialog api={api} />}
            >
              <Button padding="small" variant="solid" ariaLabel={false}>
                Share
              </Button>
            </PopoverProvider>
          </>
        ) : null
      }
    </Consumer>
  ),
};
