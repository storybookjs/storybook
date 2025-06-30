import * as React from 'react';

import {
  Button,
  IconButton,
  ScrollArea,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

import { CollapseIcon, ExpandAltIcon, EyeCloseIcon, EyeIcon, SyncIcon } from '@storybook/icons';

import type { Result } from 'axe-core';
import { useResizeDetector } from 'react-resize-detector';
import { styled } from 'storybook/theming';

import type { RuleType } from '../types';
import { useA11yContext } from './A11yContext';

const Container = styled.div({
  width: '100%',
  position: 'relative',
  minHeight: '100%',
});

const Item = styled.button<{ active?: boolean }>(
  ({ theme }) => ({
    textDecoration: 'none',
    padding: '10px 15px',
    cursor: 'pointer',
    color: theme.textMutedColor,
    fontWeight: theme.typography.weight.bold,
    fontSize: theme.typography.size.s2 - 1,
    lineHeight: 1,
    height: 40,
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'transparent',

    '&:focus': {
      outline: '0 none',
      borderColor: theme.color.secondary,
    },
  }),
  ({ active, theme }) =>
    active
      ? {
          opacity: 1,
          color: theme.color.secondary,
          borderColor: theme.color.secondary,
        }
      : {}
);

const Subnav = styled.div(({ theme }) => ({
  boxShadow: `${theme.appBorderColor} 0 -1px 0 0 inset`,
  background: theme.background.app,
  position: 'sticky',
  top: 0,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  overflow: 'auto',
  paddingRight: 10,
  gap: 6,
  scrollbarColor: `${theme.barTextColor} ${theme.background.app}`,
  scrollbarWidth: 'thin',
}));

const TabsWrapper = styled.div({});
const ActionsWrapper = styled.div({
  display: 'flex',
  flexBasis: '100%',
  justifyContent: 'flex-end',
  containerType: 'inline-size',
  // 96px is the total width of the buttons without labels
  minWidth: 96,
  gap: 6,
});

const ButtonWithCollapsibleText = styled(Button)({
  // 193px is the total width of the action buttons when the label is visible
  '@container (max-width: 193px)': {
    span: {
      display: 'none',
    },
  },
});

interface TabsProps {
  tabs: {
    label: React.ReactElement;
    panel: React.ReactElement;
    items: Result[];
    type: RuleType;
  }[];
}

export const Tabs: React.FC<TabsProps> = ({ tabs }) => {
  const { ref } = useResizeDetector({
    refreshMode: 'debounce',
    handleHeight: false,
    handleWidth: true,
  });
  const {
    tab: activeTab,
    setTab,
    toggleHighlight,
    highlighted,
    handleManual,
    allExpanded,
    handleCollapseAll,
    handleExpandAll,
  } = useA11yContext();

  const handleToggle = React.useCallback(
    (event: React.SyntheticEvent) => {
      setTab(event.currentTarget.getAttribute('data-type') as RuleType);
    },
    [setTab]
  );

  const highlightDescriptionId = React.useId();
  const highlightDescription = highlighted
    ? 'Hide accessibility highlights'
    : 'Highlight accessibility results in preview';
  const highlightLabel = highlighted ? 'Hide highlights' : 'Show highlights';

  return (
    <Container ref={ref}>
      <Subnav>
        <TabsWrapper role="tablist">
          {tabs.map((tab, index) => (
            <Item
              role="tab"
              key={index}
              data-type={tab.type}
              data-active={activeTab === tab.type}
              aria-selected={activeTab === tab.type}
              active={activeTab === tab.type}
              onClick={handleToggle}
            >
              {tab.label}
            </Item>
          ))}
        </TabsWrapper>
        <ActionsWrapper>
          <WithTooltip
            as="div"
            hasChrome={false}
            placement="top"
            tooltip={<TooltipNote note={highlightDescription} />}
            trigger="hover"
          >
            <ButtonWithCollapsibleText
              aria-label={highlightLabel}
              aria-describedby={highlightDescriptionId}
              onClick={toggleHighlight}
              active={highlighted}
            >
              {highlighted ? <EyeCloseIcon /> : <EyeIcon />}
              <span>{highlightLabel}</span>
            </ButtonWithCollapsibleText>
            <span className="sb-sr-only" id={highlightDescriptionId}>
              {highlightDescription}
            </span>
          </WithTooltip>
          <IconButton
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            label={allExpanded ? 'Collapse all results' : 'Expand all results'}
          >
            {allExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
          </IconButton>
          <IconButton onClick={handleManual} label="Rerun accessibility scan">
            <SyncIcon />
          </IconButton>
        </ActionsWrapper>
      </Subnav>
      <ScrollArea vertical horizontal>
        {tabs.find((t) => t.type === activeTab)?.panel}
      </ScrollArea>
    </Container>
  );
};
