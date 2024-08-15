import type { FC } from 'react';
import React, { useState } from 'react';

import { SyntaxHighlighter, WithTooltipPure, codeCommon } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { ChevronSmallDownIcon, ChevronSmallUpIcon } from '@storybook/icons';

import uniq from 'lodash/uniq.js';
import memoize from 'memoizerific';

import type { PropSummaryValue } from './types';

interface ArgValueProps {
  value?: PropSummaryValue;
  initialExpandedArgs?: boolean;
}

interface ArgTextProps {
  text: string;
  simple?: boolean;
}

interface ArgSummaryProps {
  value: PropSummaryValue;
  initialExpandedArgs?: boolean;
}

const ITEMS_BEFORE_EXPANSION = 8;

const Summary = styled.div<{ isExpanded?: boolean }>(({ isExpanded }) => ({
  display: 'flex',
  flexDirection: isExpanded ? 'column' : 'row',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  marginBottom: '-4px',
  minWidth: 100,
}));

const Text = styled.span<{ simple?: boolean }>(codeCommon, ({ theme, simple = false }) => ({
  flex: '0 0 auto',
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  wordBreak: 'break-word',
  whiteSpace: 'normal',
  maxWidth: '100%',
  margin: 0,
  marginRight: '4px',
  marginBottom: '4px',
  paddingTop: '2px',
  paddingBottom: '2px',
  lineHeight: '13px',
  ...(simple && {
    background: 'transparent',
    border: '0 none',
    paddingLeft: 0,
  }),
}));

const ExpandButton = styled.button(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  color: theme.color.secondary,
  marginBottom: '4px',
  background: 'none',
  border: 'none',
}));

const Expandable = styled.div(codeCommon, ({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  color: theme.color.secondary,
  fontSize: theme.typography.size.s1, // overrides codeCommon
  margin: 0,
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
}));

const Detail = styled.div<{ width: string }>(({ theme, width }) => ({
  width,
  minWidth: 200,
  maxWidth: 800,
  padding: 15,
  // Don't remove the mono fontFamily here even if it seems useless, this is used by the browser to calculate the length of a "ch" unit.
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  // Most custom stylesheet will reset the box-sizing to "border-box" and will break the tooltip.
  boxSizing: 'content-box',

  '& code': {
    padding: '0 !important',
  },
}));

const ChevronUpIcon = styled(ChevronSmallUpIcon)({
  marginLeft: 4,
});

const ChevronDownIcon = styled(ChevronSmallDownIcon)({
  marginLeft: 4,
});

const EmptyArg = () => {
  return <span>-</span>;
};

const ArgText: FC<ArgTextProps> = ({ text, simple }) => {
  return <Text simple={simple}>{text}</Text>;
};

const calculateDetailWidth = memoize(1000)((detail: string): string => {
  const lines = detail.split(/\r?\n/);

  return `${Math.max(...lines.map((x) => x.length))}ch`;
});

const getSummaryItems = (summary: string) => {
  if (!summary) {
    return [summary];
  }
  const splittedItems = summary.split('|');
  const summaryItems = splittedItems.map((value) => value.trim());

  return uniq(summaryItems);
};

const renderSummaryItems = (summaryItems: string[], isExpanded = true) => {
  let items = summaryItems;
  if (!isExpanded) {
    items = summaryItems.slice(0, ITEMS_BEFORE_EXPANSION);
  }

  return items.map((item) => <ArgText key={item} text={item === '' ? '""' : item} />);
};

const ArgSummary: FC<ArgSummaryProps> = ({ value, initialExpandedArgs }) => {
  const { summary, detail } = value;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpandedArgs || false);

  if (summary === undefined || summary === null) {
    return null;
  }
  // summary is used for the default value
  // below check fixes not displaying default values for boolean typescript vars
  // summary is used for the default value
  // below check fixes not displaying default values for boolean typescript vars
  const summaryAsString = typeof summary.toString === 'function' ? summary.toString() : summary;

  if (detail == null) {
    const cannotBeSafelySplitted = /[(){}[\]<>]/.test(summaryAsString);

    if (cannotBeSafelySplitted) {
      return <ArgText text={summaryAsString} />;
    }

    const summaryItems = getSummaryItems(summaryAsString);
    const itemsCount = summaryItems.length;
    const hasManyItems = itemsCount > ITEMS_BEFORE_EXPANSION;

    return hasManyItems ? (
      <Summary isExpanded={isExpanded}>
        {renderSummaryItems(summaryItems, isExpanded)}
        <ExpandButton onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show less...' : `Show ${itemsCount - ITEMS_BEFORE_EXPANSION} more...`}
        </ExpandButton>
      </Summary>
    ) : (
      <Summary>{renderSummaryItems(summaryItems)}</Summary>
    );
  }

  return (
    <WithTooltipPure
      closeOnOutsideClick
      placement="bottom"
      visible={isOpen}
      onVisibleChange={(isVisible) => {
        setIsOpen(isVisible);
      }}
      tooltip={
        <Detail width={calculateDetailWidth(detail)}>
          <SyntaxHighlighter language="jsx" format={false}>
            {detail}
          </SyntaxHighlighter>
        </Detail>
      }
    >
      <Expandable className="sbdocs-expandable">
        <span>{summaryAsString}</span>
        {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </Expandable>
    </WithTooltipPure>
  );
};

export const ArgValue: FC<ArgValueProps> = ({ value, initialExpandedArgs }) => {
  return value == null ? (
    <EmptyArg />
  ) : (
    <ArgSummary value={value} initialExpandedArgs={initialExpandedArgs} />
  );
};
