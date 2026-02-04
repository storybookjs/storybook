import React, { useState } from 'react';

import { Button, Modal, TabsView } from 'storybook/internal/components';
import { type Addon_BaseType, Addon_TypesEnum } from 'storybook/internal/types';

import { ShareAltIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const ejectMapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;
  return { api, refId, storyId };
};

const shareMapper = ({ api, state }: Combo) => {
  const { storyId, refId } = state;

  const items = Object.values(api.getElements(Addon_TypesEnum.experimental_SHARE_PROVIDER))
    .map((registeredShareProvider) => {
      const { id, title, render, order = 0 } = registeredShareProvider;
      return { id, title, children: <>{render()}</>, order: order ?? 0 };
    })
    .sort((a, b) => a.order - b.order);

  return { items, storyId };
};

function Share({ items }: { items: ReturnType<typeof shareMapper>['items'] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Button padding="small" variant="solid" ariaLabel={false} onClick={() => setIsOpen(true)}>
        Share
      </Button>
      <Modal open={isOpen} onOpenChange={(isOpenNow) => setIsOpen(isOpenNow)}>
        {items.length > 1 ? (
          <TabsView tabs={items} backgroundColor="transparent" />
        ) : (
          items[0].children
        )}
      </Modal>
    </>
  );
}

export const ejectTool: Addon_BaseType = {
  title: 'eject',
  id: 'eject',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={ejectMapper}>
      {({ api, storyId, refId }) =>
        storyId ? (
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
        ) : null
      }
    </Consumer>
  ),
};

export const shareTool: Addon_BaseType = {
  title: 'share',
  id: 'share',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={shareMapper}>
      {({ storyId, items }) => (storyId ? <Share items={items} /> : null)}
    </Consumer>
  ),
};
