import React from 'react';

import { TooltipLinkList } from '@storybook/core/components';
import { styled, useTheme } from '@storybook/core/theming';
import { ShareAltIcon } from '@storybook/icons';
import type { Tag } from '@storybook/types';

import type { API } from '@storybook/core/manager-api';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

const BUILT_IN_TAGS_SHOW = new Set(['play-fn']);

const Wrapper = styled.div({
  minWidth: 180,
  maxWidth: 220,
});

interface TagsFilterPanelProps {
  api: API;
  allTags: Tag[];
  selectedTags: Tag[];
  toggleTag: (tag: Tag) => void;
  isDevelopment: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  toggleTag,
  isDevelopment,
}: TagsFilterPanelProps) => {
  const userTags = allTags.filter((tag) => !BUILT_IN_TAGS_SHOW.has(tag));
  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' });

  const groups = [
    allTags.map((tag) => {
      const checked = selectedTags.includes(tag);
      const id = `tag-${tag}`;
      return {
        id,
        title: tag,
        right: (
          <input
            type="checkbox"
            id={id}
            name={id}
            value={tag}
            checked={checked}
            onChange={() => {
              // The onClick handler higher up the tree will handle the toggle
              // For controlled inputs, a onClick handler is needed, though
              // Accessibility-wise this isn't optimal, but I guess that's a limitation
              // of the current design of TooltipLinkList
            }}
          />
        ),
        onClick: () => toggleTag(tag),
      };
    }),
  ] as Link[][];

  if (allTags.length === 0) {
    groups.push([
      {
        id: 'no-tags',
        title: 'There are no tags. Use tags to organize and filter your Storybook.',
        isIndented: false,
      },
    ]);
  }

  if (userTags.length === 0 && isDevelopment) {
    groups.push([
      {
        id: 'tags-docs',
        title: 'Learn how to add tags',
        icon: <ShareAltIcon />,
        href: docsUrl,
      },
    ]);
  }

  return (
    <Wrapper>
      <TooltipLinkList links={groups} />
    </Wrapper>
  );
};
