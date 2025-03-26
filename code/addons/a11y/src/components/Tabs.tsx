import * as React from 'react';

import { IconButton, ScrollArea, TooltipNote, WithTooltip } from 'storybook/internal/components';

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

const TabsWrapper = styled.div({});
const ActionsWrapper = styled.div({ display: 'flex', gap: 6 });

const Subnav = styled.div(({ theme }) => ({
  boxShadow: `${theme.appBorderColor} 0 -1px 0 0 inset`,
  background: theme.background.app,
  position: 'sticky',
  top: 0,
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  whiteSpace: 'nowrap',
  paddingRight: 10,
}));

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

  return (
    <Container ref={ref}>
      <Subnav>
        <TabsWrapper>
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
            tooltip={<TooltipNote note="Highlight elements with accessibility violations" />}
            trigger="hover"
          >
            <IconButton onClick={toggleHighlight} active={highlighted}>
              {highlighted ? <EyeCloseIcon /> : <EyeIcon />}
              {highlighted ? 'Hide highlights' : 'Show highlights'}
            </IconButton>
          </WithTooltip>
          <WithTooltip
            as="div"
            hasChrome={false}
            placement="top"
            tooltip={<TooltipNote note={allExpanded ? 'Collapse all' : 'Expand all'} />}
            trigger="hover"
          >
            <IconButton
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}
              aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
            >
              {allExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
            </IconButton>
          </WithTooltip>
          <WithTooltip
            as="div"
            hasChrome={false}
            placement="top"
            tooltip={<TooltipNote note="Rerun the accessibility scan" />}
            trigger="hover"
          >
            <IconButton onClick={handleManual} aria-label="Rerun accessibility scan">
              <SyncIcon />
            </IconButton>
          </WithTooltip>
        </ActionsWrapper>
      </Subnav>
      <ScrollArea vertical horizontal>
        {tabs.find((t) => t.type === activeTab)?.panel}
      </ScrollArea>
    </Container>
  );
};
