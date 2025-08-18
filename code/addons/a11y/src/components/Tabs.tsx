import * as React from 'react';

import { AriaTabs, Button } from 'storybook/internal/components';

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

const CollapsibleButton = styled(Button)({
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
        panelProps={{ hasScrollbar: true }}
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
            {highlighted ? (
              <CollapsibleButton
                onClick={toggleHighlight}
                ariaLabel="Hide accessibility test result highlights"
                tooltip="Hide accessibility test result highlights"
              >
                <EyeCloseIcon />
                <span>Hide highlights</span>
              </CollapsibleButton>
            ) : (
              <CollapsibleButton
                onClick={toggleHighlight}
                variant="ghost"
                ariaLabel="Highlight elements with accessibility test results"
                tooltip="Highlight elements with accessibility test results"
              >
                <EyeIcon />
                <span>Show highlights</span>
              </CollapsibleButton>
            )}
            <Button
              variant="ghost"
              padding="small"
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}
              ariaLabel={allExpanded ? 'Collapse all results' : 'Expand all results'}
              aria-expanded={allExpanded}
            >
              {allExpanded ? <CollapseIcon /> : <ExpandAltIcon />}
            </Button>
            <Button
              variant="ghost"
              padding="small"
              onClick={handleManual}
              ariaLabel="Rerun accessibility scan"
            >
              <SyncIcon />
            </Button>
          </ActionsWrapper>
        }
      />
    </Container>
  );
};
