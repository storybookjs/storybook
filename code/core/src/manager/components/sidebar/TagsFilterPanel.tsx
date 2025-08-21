import React from 'react';

import { Form, TooltipLinkList } from 'storybook/internal/components';
import type { Tag } from 'storybook/internal/types';

import { BatchAcceptIcon, CloseIcon, DocumentIcon, ShareAltIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

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
  setAllTags: (selected: boolean) => void;
  isDevelopment: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  toggleTag,
  setAllTags,
  isDevelopment,
}: TagsFilterPanelProps) => {
  const userTags = allTags.filter((tag) => !BUILT_IN_TAGS_SHOW.has(tag));
  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' });

  const selectAllTags = {
    id: 'select-all',
    title: 'Select all tags',
    icon: <BatchAcceptIcon />,
    onClick: () => setAllTags(true),
  };
  const unselectAllTags = {
    id: 'unselect-all',
    title: 'Clear selection',
    icon: <CloseIcon />,
    onClick: () => setAllTags(false),
  };
  const noTags = {
    id: 'no-tags',
    title: 'There are no tags. Use tags to organize and filter your Storybook.',
    isIndented: false,
  };

  const groups = [
    [allTags.length ? (selectedTags.length ? unselectAllTags : selectAllTags) : noTags],
    allTags.map((tag) => {
      const checked = selectedTags.includes(tag);
      const id = `tag-${tag}`;
      return {
        id,
        title: tag,
        input: <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} />,
      };
    }),
  ] as Link[][];

  if (userTags.length === 0 && isDevelopment) {
    groups.push([
      {
        id: 'tags-docs',
        title: 'Learn how to add tags',
        icon: <DocumentIcon />,
        right: <ShareAltIcon />,
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
