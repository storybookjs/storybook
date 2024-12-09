import React, { useMemo } from 'react';

import { ActionBar, ScrollArea } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { CheckIcon, SyncIcon } from '@storybook/icons';

import { useA11yContext } from './A11yContext';
import { Report } from './Report';
import { Tabs } from './Tabs';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

export enum RuleType {
  VIOLATION,
  PASS,
  INCOMPLETION,
}

const Icon = styled(SyncIcon)({
  marginRight: 4,
});

const RotatingIcon = styled(Icon)(({ theme }) => ({
  animation: `${theme.animation.rotate360} 1s linear infinite;`,
}));

const Passes = styled.span(({ theme }) => ({
  color: theme.color.positiveText,
}));

const Violations = styled.span(({ theme }) => ({
  color: theme.color.negativeText,
}));

const Incomplete = styled.span(({ theme }) => ({
  color: theme.color.warningText,
}));

const Centered = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
});

export const A11YPanel: React.FC = () => {
  const { results, status, handleManual, error, discrepancy } = useA11yContext();

  const manualActionItems = useMemo(
    () => [{ title: 'Run test', onClick: handleManual }],
    [handleManual]
  );
  const readyActionItems = useMemo(
    () => [
      {
        title:
          status === 'ready' ? (
            'Rerun tests'
          ) : (
            <>
              <CheckIcon style={{ marginRight: '0.4em' }} />
              Tests completed
            </>
          ),
        onClick: handleManual,
      },
    ],
    [status, handleManual]
  );
  const tabs = useMemo(() => {
    const { passes, incomplete, violations } = results;
    return [
      {
        label: <Violations>{violations.length} Violations</Violations>,
        panel: (
          <Report
            items={violations}
            type={RuleType.VIOLATION}
            empty="No accessibility violations found."
          />
        ),
        items: violations,
        type: RuleType.VIOLATION,
      },
      {
        label: <Passes>{passes.length} Passes</Passes>,
        panel: (
          <Report items={passes} type={RuleType.PASS} empty="No accessibility checks passed." />
        ),
        items: passes,
        type: RuleType.PASS,
      },
      {
        label: <Incomplete>{incomplete.length} Incomplete</Incomplete>,
        panel: (
          <Report
            items={incomplete}
            type={RuleType.INCOMPLETION}
            empty="No accessibility checks incomplete."
          />
        ),
        items: incomplete,
        type: RuleType.INCOMPLETION,
      },
    ];
  }, [results]);

  return (
    <>
      {discrepancy && <TestDiscrepancyMessage discrepancy={discrepancy} />}
      {status === 'ready' || status === 'ran' ? (
        <>
          <ScrollArea vertical horizontal>
            <Tabs key="tabs" tabs={tabs} />
          </ScrollArea>
          <ActionBar key="actionbar" actionItems={readyActionItems} />
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
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </>
          )}
        </Centered>
      )}
    </>
  );
};
