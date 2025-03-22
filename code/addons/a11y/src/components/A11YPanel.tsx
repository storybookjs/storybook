import React, { useMemo } from 'react';

import { Badge, Button, ScrollArea } from 'storybook/internal/components';

import { SyncIcon } from '@storybook/icons';

import { useParameter } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { PARAM_KEY } from '../constants';
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

const Centered = styled.span(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  fontSize: theme.typography.size.s2,
  height: '100%',
  gap: 24,

  div: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  p: {
    margin: 0,
    color: theme.textMutedColor,
  },
  code: {
    display: 'inline-block',
    fontSize: theme.typography.size.s2 - 1,
    backgroundColor: theme.background.app,
    border: `1px solid ${theme.color.border}`,
    borderRadius: 4,
    padding: '2px 3px',
  },
}));

const Count = styled(Badge)({
  padding: 4,
  minWidth: 24,
});

export const A11YPanel: React.FC = () => {
  const { manual } = useParameter(PARAM_KEY, {} as any);
  const {
    results,
    status,
    handleManual,
    error,
    discrepancy,
    handleSelectionChange,
    selectedItems,
    toggleOpen,
  } = useA11yContext();

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
            handleSelectionChange={handleSelectionChange}
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
            handleSelectionChange={handleSelectionChange}
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
            handleSelectionChange={handleSelectionChange}
            selectedItems={selectedItems}
            toggleOpen={toggleOpen}
          />
        ),
        items: incomplete,
        type: RuleType.INCOMPLETION,
      },
    ];
  }, [results, handleSelectionChange, selectedItems, toggleOpen]);

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
              <div>
                <strong>Accessibility tests run manually for this story</strong>
                <p>
                  Results will not show when using the testing module. You can still run
                  accessibility tests manually.
                </p>
              </div>
              <Button size="medium" onClick={handleManual}>
                Run accessibility scan
              </Button>
              <p>
                Update <code>{manual ? 'parameters' : 'globals'}.a11y.manual</code> to disable
                manual mode.
              </p>
            </>
          )}
          {status === 'running' && (
            <>
              <RotatingIcon size={12} /> Please wait while the accessibility scan is running ...
            </>
          )}
          {status === 'error' && (
            <>
              <div>
                <strong>The accessibility scan encountered an error</strong>
                <p>
                  {typeof error === 'string'
                    ? error
                    : error instanceof Error
                      ? error.toString()
                      : JSON.stringify(error, null, 2)}
                </p>
              </div>
              <Button size="medium" onClick={handleManual}>
                Rerun accessibility scan
              </Button>
            </>
          )}
          {status === 'broken' && (
            <>
              <div>
                <strong>This story&apos;s component tests failed</strong>
                <p>
                  Automated accessibility tests will not run until this is resolved. You can still
                  test manually.
                </p>
              </div>
              <Button size="medium" onClick={handleManual}>
                Run accessibility scan
              </Button>
            </>
          )}
        </Centered>
      )}
    </>
  );
};
