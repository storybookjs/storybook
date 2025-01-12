import * as React from 'react';

import { styled } from 'storybook/internal/theming';

import type { NodeResult, Result } from 'axe-core';
import { useResizeDetector } from 'react-resize-detector';

import type { RuleType } from './A11YPanel';
import { useA11yContext } from './A11yContext';
import HighlightToggle from './Report/HighlightToggle';

// TODO: reuse the Tabs component from @storybook/theming instead of re-building identical functionality

const Container = styled.div({
  width: '100%',
  position: 'relative',
  minHeight: '100%',
});

const HighlightToggleLabel = styled.label(({ theme }) => ({
  cursor: 'pointer',
  userSelect: 'none',
  color: theme.color.dark,
}));

const GlobalToggle = styled.div(() => ({
  alignItems: 'center',
  cursor: 'pointer',
  display: 'flex',
  fontSize: 13,
  height: 40,
  padding: '0 15px',

  input: {
    marginBottom: 0,
    marginLeft: 10,
    marginRight: 0,
    marginTop: -1,
  },
}));

const Item = styled.button<{ active?: boolean }>(
  ({ theme }) => ({
    textDecoration: 'none',
    padding: '10px 15px',
    cursor: 'pointer',
    fontWeight: theme.typography.weight.bold,
    fontSize: theme.typography.size.s2 - 1,
    lineHeight: 1,
    height: 40,
    border: 'none',
    borderTop: '3px solid transparent',
    borderBottom: '3px solid transparent',
    background: 'transparent',

    '&:focus': {
      outline: '0 none',
      borderBottom: `3px solid ${theme.color.secondary}`,
    },
  }),
  ({ active, theme }) =>
    active
      ? {
          opacity: 1,
          borderBottom: `3px solid ${theme.color.secondary}`,
        }
      : {}
);

const TabsWrapper = styled.div({});

const List = styled.div(({ theme }) => ({
  boxShadow: `${theme.appBorderColor} 0 -1px 0 0 inset`,
  background: theme.background.app,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  whiteSpace: 'nowrap',
}));

interface TabsProps {
  tabs: {
    label: React.ReactElement;
    panel: React.ReactElement;
    items: Result[];
    type: RuleType;
  }[];
}

function retrieveAllNodesFromResults(items: Result[]): NodeResult[] {
  return items.reduce((acc, item) => acc.concat(item.nodes), [] as NodeResult[]);
}

export const Tabs: React.FC<TabsProps> = ({ tabs }) => {
  const { ref, width } = useResizeDetector({
    refreshMode: 'debounce',
    handleHeight: false,
    handleWidth: true,
  });
  const { tab: activeTab, setTab } = useA11yContext();

  const handleToggle = React.useCallback(
    (event: React.SyntheticEvent) => {
      setTab(parseInt(event.currentTarget.getAttribute('data-index') || '', 10));
    },
    [setTab]
  );

  const highlightToggleId = `${tabs[activeTab].type}-global-checkbox`;
  const highlightLabel = `Highlight results`;
  return (
    <Container ref={ref}>
      <List>
        <TabsWrapper>
          {tabs.map((tab, index) => (
            <Item
              key={index}
              data-index={index}
              active={activeTab === index}
              onClick={handleToggle}
            >
              {tab.label}
            </Item>
          ))}
        </TabsWrapper>
        {tabs[activeTab].items.length > 0 ? (
          <GlobalToggle>
            <HighlightToggleLabel htmlFor={highlightToggleId}>
              {highlightLabel}
            </HighlightToggleLabel>
            <HighlightToggle
              toggleId={highlightToggleId}
              elementsToHighlight={retrieveAllNodesFromResults(tabs[activeTab].items)}
            />
          </GlobalToggle>
        ) : null}
      </List>
      {tabs[activeTab].panel}
    </Container>
  );
};
