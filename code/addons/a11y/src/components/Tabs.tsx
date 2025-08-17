import * as React from 'react';

import {
  AriaTabs,
  IconButton,
  ScrollArea,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

import { CollapseIcon, ExpandAltIcon, EyeCloseIcon, EyeIcon, SyncIcon } from '@storybook/icons';

import type { Result } from 'axe-core';
import { styled, useTheme } from 'storybook/theming';

import type { RuleType } from '../types';
import { useA11yContext } from './A11yContext';

const Container = styled.div({
  width: '100%',
  position: 'relative',
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const ActionsWrapper = styled.div({
  display: 'flex',
  flexBasis: '100%',
  justifyContent: 'flex-end',
  containerType: 'inline-size',
  // 96px is the total width of the buttons without labels
  minWidth: 96,
  gap: 6,
});

const ToggleButton = styled(IconButton)({
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
  const {
    tab,
    setTab,
    toggleHighlight,
    highlighted,
    handleManual,
    allExpanded,
    handleCollapseAll,
    handleExpandAll,
  } = useA11yContext();

  const theme = useTheme();

  return (
    <Container>
      <AriaTabs
        backgroundColor={theme.background.app}
        hasScrollbar={true}
        tabs={tabs.map((tab) => ({
          id: tab.type,
          title: tab.label,
          children: tab.panel,
        }))}
        selected={tab}
        // Safe to cast key to RuleType because we use RuleTypes as IDs above.
        onSelectionChange={(key) => setTab(key as RuleType)}
        tools={
          <ActionsWrapper>
            <WithTooltip
              as="div"
              hasChrome={false}
              placement="top"
              tooltip={<TooltipNote note="Highlight elements with accessibility violations" />}
              trigger="hover"
            >
              <ToggleButton onClick={toggleHighlight} active={highlighted}>
                {highlighted ? <EyeCloseIcon /> : <EyeIcon />}
                <span>{highlighted ? 'Hide highlights' : 'Show highlights'}</span>
              </ToggleButton>
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
        }
      />
    </Container>
  );
};
