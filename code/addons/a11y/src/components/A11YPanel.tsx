import React, { useMemo } from 'react';

import { Badge, Button } from 'storybook/internal/components';

import { SyncIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { RuleType } from '../types';
import { useA11yContext } from './A11yContext';
import { Report } from './Report/Report';
import { Tabs } from './Tabs';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

const RotatingIcon = styled(SyncIcon)(({ theme }) => ({
  animation: `${theme.animation.rotate360} 1s linear infinite;`,
  margin: 4,
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
    alignItems: 'center',
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

export const A11YPanel: React.FC = () => {
  const {
    parameters,
    tab,
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
    const { passes, incomplete, violations } = results ?? {
      passes: [],
      incomplete: [],
      violations: [],
    };
    return [
      {
        label: (
          <Tab>
            Violations
            <Badge compact status={tab === 'violations' ? 'active' : 'neutral'}>
              {violations.length}
            </Badge>
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
            <Badge compact status={tab === 'passes' ? 'active' : 'neutral'}>
              {passes.length}
            </Badge>
          </Tab>
        ),
        panel: (
          <Report
            items={passes}
            type={RuleType.PASS}
            empty="No passing accessibility checks found."
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
            Inconclusive
            <Badge compact status={tab === 'incomplete' ? 'active' : 'neutral'}>
              {incomplete.length}
            </Badge>
          </Tab>
        ),
        panel: (
          <Report
            items={incomplete}
            type={RuleType.INCOMPLETION}
            empty="No inconclusive accessibility checks found."
            handleSelectionChange={handleSelectionChange}
            selectedItems={selectedItems}
            toggleOpen={toggleOpen}
          />
        ),
        items: incomplete,
        type: RuleType.INCOMPLETION,
      },
    ];
  }, [tab, results, handleSelectionChange, selectedItems, toggleOpen]);

  if (parameters.disable || parameters.test === 'off') {
    return (
      <Centered>
        <div>
          <strong>Accessibility tests are disabled for this story</strong>
          <p>
            Update{' '}
            <code>{parameters.disable ? 'parameters.a11y.disable' : 'parameters.a11y.test'}</code>{' '}
            to enable accessibility tests.
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <>
      {discrepancy && <TestDiscrepancyMessage discrepancy={discrepancy} />}
      {status === 'ready' || status === 'ran' ? (
        <Tabs key="tabs" tabs={tabs} />
      ) : (
        <Centered style={{ marginTop: discrepancy ? '1em' : 0 }}>
          {status === 'initial' && (
            <div>
              <RotatingIcon size={12} />
              <strong>Preparing accessibility scan</strong>
              <p>Please wait while the addon is initializing...</p>
            </div>
          )}
          {status === 'manual' && (
            <>
              <div>
                <strong>Accessibility tests run manually for this story</strong>
                <p>
                  Results will not show when using the testing module. You can still run
                  accessibility tests manually.
                </p>
              </div>
              <Button ariaLabel={false} size="medium" onClick={handleManual}>
                Run accessibility scan
              </Button>
              <p>
                Update <code>globals.a11y.manual</code> to disable manual mode.
              </p>
            </>
          )}
          {status === 'running' && (
            <div>
              <RotatingIcon size={12} />
              <strong>Accessibility scan in progress</strong>
              <p>Please wait while the accessibility scan is running...</p>
            </div>
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
              <Button ariaLabel={false} size="medium" onClick={handleManual}>
                Rerun accessibility scan
              </Button>
            </>
          )}
          {status === 'component-test-error' && (
            <>
              <div>
                <strong>This story&apos;s component tests failed</strong>
                <p>
                  Automated accessibility tests will not run until this is resolved. You can still
                  test manually.
                </p>
              </div>
              <Button ariaLabel={false} size="medium" onClick={handleManual}>
                Run accessibility scan
              </Button>
            </>
          )}
        </Centered>
      )}
    </>
  );
};
