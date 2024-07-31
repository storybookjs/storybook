import React, { useCallback, useMemo, useState } from 'react';

import { styled } from 'storybook/internal/theming';

import { ActionBar, ScrollArea } from 'storybook/internal/components';
import { SyncIcon, CheckIcon } from '@storybook/icons';

import type { AxeResults } from 'axe-core';
import {
  useChannel,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/internal/manager-api';

import { Report } from './Report';

import { Tabs } from './Tabs';

import { useA11yContext } from './A11yContext';
import { EVENTS } from '../constants';
import type { A11yParameters } from '../params';

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

type Status = 'initial' | 'manual' | 'running' | 'error' | 'ran' | 'ready';

export const A11YPanel: React.FC = () => {
  const { manual } = useParameter<Pick<A11yParameters, 'manual'>>('a11y', {
    manual: false,
  });
  const [status, setStatus] = useState<Status>(manual ? 'manual' : 'initial');
  const [error, setError] = React.useState<unknown>(undefined);
  const { setResults, results } = useA11yContext();
  const { storyId } = useStorybookState();
  const api = useStorybookApi();

  React.useEffect(() => {
    setStatus(manual ? 'manual' : 'initial');
  }, [manual]);

  const handleResult = (axeResults: AxeResults) => {
    setStatus('ran');
    setResults(axeResults);

    setTimeout(() => {
      if (status === 'ran') {
        setStatus('ready');
      }
    }, 900);
  };

  const handleRun = useCallback(() => {
    setStatus('running');
  }, []);

  const handleError = useCallback((err: unknown) => {
    setStatus('error');
    setError(err);
  }, []);

  const emit = useChannel({
    [EVENTS.RUNNING]: handleRun,
    [EVENTS.RESULT]: handleResult,
    [EVENTS.ERROR]: handleError,
  });

  const handleManual = useCallback(() => {
    setStatus('running');
    emit(EVENTS.MANUAL, storyId, api.getParameters(storyId, 'a11y'));
  }, [storyId]);

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
              <CheckIcon /> Tests completed
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
      {status === 'initial' && <Centered>Initializing...</Centered>}
      {status === 'manual' && (
        <>
          <Centered>Manually run the accessibility scan.</Centered>
          <ActionBar key="actionbar" actionItems={manualActionItems} />
        </>
      )}
      {status === 'running' && (
        <Centered>
          <RotatingIcon size={12} /> Please wait while the accessibility scan is running ...
        </Centered>
      )}
      {(status === 'ready' || status === 'ran') && (
        <>
          <ScrollArea vertical horizontal>
            <Tabs key="tabs" tabs={tabs} />
          </ScrollArea>
          <ActionBar key="actionbar" actionItems={readyActionItems} />
        </>
      )}
      {status === 'error' && (
        <Centered>
          The accessibility scan encountered an error.
          <br />
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </Centered>
      )}
    </>
  );
};
