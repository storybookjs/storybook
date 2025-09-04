import React, { useRef } from 'react';

import {
  Button,
  Form,
  IconButton,
  ListItem,
  TooltipLinkList,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import type { Tag } from 'storybook/internal/types';

import {
  BatchAcceptIcon,
  CheckIcon,
  DeleteIcon,
  DocumentIcon,
  ShareAltIcon,
  SweepIcon,
  UndoIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';

const BUILT_IN_TAGS = new Set([
  'dev',
  'test',
  'dev-only',
  'test-only',
  'docs-only',
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

const TagRow = styled.div({
  display: 'flex',

  '& button': {
    width: 64,
    maxWidth: 64,
    marginLeft: 4,
    paddingLeft: 0,
    paddingRight: 0,
    fontWeight: 'normal',
    transition: 'all 150ms',
  },
  '&:not(:hover)': {
    '& button': {
      marginLeft: 0,
      maxWidth: 0,
      opacity: 0,
    },
    '& svg + input': {
      display: 'none',
    },
  },
});

const Label = styled.div({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

interface TagsFilterPanelProps {
  api: API;
  allTags: Map<Tag, number>;
  includedTags: Set<Tag>;
  excludedTags: Set<Tag>;
  toggleTag: (tag: Tag, excluded?: boolean) => void;
  setAllTags: (selected: boolean) => void;
  resetTags: () => void;
  isDevelopment: boolean;
  isDefaultSelection: boolean;
  hasDefaultSelection: boolean;
}

export const TagsFilterPanel = ({
  api,
  allTags,
  includedTags,
  excludedTags,
  toggleTag,
  setAllTags,
  resetTags,
  isDevelopment,
  isDefaultSelection,
  hasDefaultSelection,
}: TagsFilterPanelProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [builtInEntries, userEntries] = allTags.entries().reduce(
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

  const renderTag = ([tag, count]: [Tag, number]) => {
    const excluded = excludedTags.has(tag);
    const checked = excluded || includedTags.has(tag);
    const id = `tag-${tag}`;
    return {
      id,
      content: (
        <TagRow>
          <WithTooltip
            hasChrome={false}
            style={{ minWidth: 0, flex: 1 }}
            tooltip={<TooltipNote note={`${checked ? 'Remove' : 'Add'} tag filter: ${tag}`} />}
            trigger="hover"
          >
            <ListItem
              as="label"
              icon={
                <>
                  {checked && (excluded ? <DeleteIcon /> : <CheckIcon />)}
                  <Form.Checkbox checked={checked} onChange={() => toggleTag(tag)} data-tag={tag} />
                </>
              }
              title={
                <Label>
                  {tag}
                  {excluded && <MutedText> (excluded)</MutedText>}
                </Label>
              }
              right={excluded ? <s>{count}</s> : <span>{count}</span>}
            />
          </WithTooltip>
          <WithTooltip
            hasChrome={false}
            tooltip={<TooltipNote note={`${excluded ? 'Include' : 'Exclude'} tag: ${tag}`} />}
            trigger="hover"
          >
            <Button variant="ghost" size="medium" onClick={() => toggleTag(tag, !excluded)}>
              {excluded ? 'Include' : 'Exclude'}
            </Button>
          </WithTooltip>
        </TagRow>
      ),
    };
  };

  const groups = [
    allTags.size === 0 ? [noTags] : [],
    userEntries.sort((a, b) => a[0].localeCompare(b[0])).map(renderTag),
    builtInEntries.sort((a, b) => a[0].localeCompare(b[0])).map(renderTag),
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
    <Wrapper ref={ref}>
      {allTags.size > 0 && (
        <Actions>
          {includedTags.size === 0 && excludedTags.size === 0 ? (
            <IconButton id="select-all" key="select-all" onClick={() => setAllTags(true)}>
              <BatchAcceptIcon />
              Select all
            </IconButton>
          ) : (
            <IconButton id="deselect-all" key="deselect-all" onClick={() => setAllTags(false)}>
              <SweepIcon />
              Clear filters
            </IconButton>
          )}
          {hasDefaultSelection && (
            <WithTooltip
              hasChrome={false}
              tooltip={<TooltipNote note="Reset to default selection" />}
              trigger="hover"
            >
              <IconButton
                id="reset-filters"
                key="reset-filters"
                onClick={resetTags}
                aria-label="Reset filters"
                disabled={isDefaultSelection}
              >
                <UndoIcon />
              </IconButton>
            </WithTooltip>
          )}
        </Actions>
      )}
      <TooltipLinkList links={groups} />
    </Wrapper>
  );
};
