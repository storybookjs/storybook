import React from 'react';

import { Button, Form, ToggleButton, TooltipLinkList } from 'storybook/internal/components';
import type { Tag } from 'storybook/internal/types';

import {
  BatchAcceptIcon,
  CloseIcon,
  DocumentIcon,
  EyeCloseIcon,
  EyeIcon,
  ShareAltIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'autodocs',
  'attached-mdx',
  'unattached-mdx',
  'play-fn',
  'test-fn',
  'vitest',
  'svelte-csf',
  'svelte-csf-v4',
  'svelte-csf-v5',
]);

const Wrapper = styled.div({
  minWidth: 240,
  maxWidth: 300,
});

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 4,
  padding: 4,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

interface TagsFilterPanelProps {
  api: API;
  allTags: Map<Tag, number>;
  selectedTags: Tag[];
  toggleTag: (tag: Tag) => void;
  setAllTags: (selected: boolean) => void;
  inverted: boolean;
  setInverted: (inverted: boolean) => void;
  isDevelopment: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  selectedTags,
  toggleTag,
  setAllTags,
  inverted,
  setInverted,
  isDevelopment,
}: TagsFilterPanelProps) => {
  const [builtInEntries, userEntries] = Array.from(allTags.entries()).reduce(
    (acc, [tag, count]) => {
      acc[BUILT_IN_TAGS.has(tag) ? 0 : 1].push([tag, count]);
      return acc;
    },
    [[], []] as [[Tag, number][], [Tag, number][]]
  );

  const docsUrl = api.getDocsUrl({ subpath: 'writing-stories/tags#filtering-by-custom-tags' });

  const noTags = {
    id: 'no-tags',
    title: 'There are no tags. Use tags to organize and filter your Storybook.',
    isIndented: false,
  };

  const groups = [
    allTags.size === 0 ? [noTags] : [],
    userEntries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => {
        const checked = selectedTags.includes(tag);
        const id = `tag-${tag}`;
        return {
          id,
          title: tag,
          right: count,
          input: <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} />,
        };
      }),
    builtInEntries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => {
        const checked = selectedTags.includes(tag);
        const id = `tag-${tag}`;
        return {
          id,
          title: tag,
          right: count,
          input: <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} />,
        };
      }),
  ] as Link[][];

  if (userEntries.length === 0 && isDevelopment) {
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
      {allTags.size > 0 && (
        <Actions>
          {selectedTags.length ? (
            <Button
              ariaLabel={false}
              variant="ghost"
              padding="small"
              id="unselect-all"
              onClick={() => setAllTags(false)}
            >
              <CloseIcon />
              Clear filters
            </Button>
          ) : (
            <Button
              ariaLabel={false}
              variant="ghost"
              padding="small"
              id="select-all"
              onClick={() => setAllTags(true)}
            >
              <BatchAcceptIcon />
              Select all
            </Button>
          )}
          <ToggleButton
            ariaLabel={false}
            id="invert-selection"
            variant="ghost"
            disabled={selectedTags.length === 0}
            onClick={() => setInverted(!inverted)}
            pressed={inverted}
          >
            {inverted ? <EyeCloseIcon /> : <EyeIcon />}
            Invert
          </ToggleButton>
        </Actions>
      )}
      <TooltipLinkList links={groups} />
    </Wrapper>
  );
};
