import React, { useMemo } from 'react';

import { ActionBar, Badge, ScrollArea } from 'storybook/internal/components';

import { SyncIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { RuleType } from '../types';
import { useA11yContext } from './A11yContext';
import { Report } from './Report/Report';
import { Tabs } from './Tabs';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

const Icon = styled(SyncIcon)({
  marginRight: 4,
});

const RotatingIcon = styled(Icon)(({ theme }) => ({
  animation: `${theme.animation.rotate360} 1s linear infinite;`,
}));

const Tab = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const Centered = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
});

const Count = styled(Badge)({
  padding: 4,
  minWidth: 24,
});

export const A11YPanel: React.FC = () => {
  const {
    results,
    status,
    handleManual,
    error,
    discrepancy,
    onSelectionChange,
    selectedItems,
    toggleOpen,
  } = useA11yContext();

  const manualActionItems = useMemo(
    () => [{ title: 'Run test', onClick: handleManual }],
    [handleManual]
  );
  const tabs = useMemo(() => {
    const { passes, incomplete, violations } = results;
    return [
      {
        label: (
          <Tab>
            Violations
            <Count status="neutral">{violations.length}</Count>
          </Tab>
        ),
        panel: (
          <Report
            items={violations}
            type={RuleType.VIOLATION}
            empty="No accessibility violations found."
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            toggleOpen={toggleOpen}
          />
        ),
        items: violations,
        type: RuleType.VIOLATION,
      },
      {
        label: (
          <Tab>
            Passes
            <Count status="neutral">{passes.length}</Count>
          </Tab>
        ),
        panel: (
          <Report
            items={passes}
            type={RuleType.PASS}
            empty="No accessibility checks passed."
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            toggleOpen={toggleOpen}
          />
        ),
        items: passes,
        type: RuleType.PASS,
      },
      {
        label: (
          <Tab>
            Incomplete
            <Count status="neutral">{incomplete.length}</Count>
          </Tab>
        ),
        panel: (
          <Report
            items={incomplete}
            type={RuleType.INCOMPLETION}
            empty="No accessibility checks incomplete."
            onSelectionChange={onSelectionChange}
            selectedItems={selectedItems}
            toggleOpen={toggleOpen}
          />
        ),
        items: incomplete,
        type: RuleType.INCOMPLETION,
      },
    ];
  }, [results, onSelectionChange, selectedItems, toggleOpen]);

  return (
    <>
      {discrepancy && <TestDiscrepancyMessage discrepancy={discrepancy} />}
      {status === 'ready' || status === 'ran' ? (
        <>
          <ScrollArea vertical horizontal>
            <Tabs key="tabs" tabs={tabs} />
          </ScrollArea>
        </>
      ) : (
        <Centered style={{ marginTop: discrepancy ? '1em' : 0 }}>
          {status === 'initial' && 'Initializing...'}
          {status === 'manual' && (
            <>
              <>Manually run the accessibility scan.</>
              <ActionBar key="actionbar" actionItems={manualActionItems} />
            </>
          )}
          {status === 'running' && (
            <>
              <RotatingIcon size={12} /> Please wait while the accessibility scan is running ...
            </>
          )}
          {status === 'error' && (
            <>
              The accessibility scan encountered an error.
              <br />
              {typeof error === 'string'
                ? error
                : error instanceof Error
                  ? error.toString()
                  : JSON.stringify(error)}
            </>
          )}
        </Centered>
      )}
    </>
  );
};
