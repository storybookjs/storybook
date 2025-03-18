import React, { useCallback, useMemo, useState } from 'react';

import { ActionBar, Badge, ScrollArea } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';

import { CheckIcon, SyncIcon } from '@storybook/icons';

import type { Result } from 'axe-core';
import { styled } from 'storybook/theming';

import { useA11yContext } from './A11yContext';
import { Report } from './Report/Report';
import { Tabs } from './Tabs';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

export enum RuleType {
  VIOLATION = 'violations',
  PASS = 'passes',
  INCOMPLETION = 'incomplete',
}

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
  const api = useStorybookApi();
  const { results, status, handleManual, error, discrepancy } = useA11yContext();

  const [selectedItems, setSelectedItems] = useState<Map<string, string>>(() => {
    const initialValue = new Map();
    const a11ySelection = api.getQueryParam('a11ySelection');
    if (a11ySelection && /^[a-z]+.[a-z-]+.[0-9]+$/.test(a11ySelection)) {
      const [type, id] = a11ySelection.split('.');
      initialValue.set(`${type}.${id}`, a11ySelection);
    }
    return initialValue;
  });

  const toggleOpen = useCallback(
    (event: React.SyntheticEvent<Element>, type: RuleType, item: Result) => {
      event.stopPropagation();
      const key = `${type}.${item.id}`;
      setSelectedItems((prev) => new Map(prev.delete(key) ? prev : prev.set(key, `${key}.1`)));
    },
    []
  );

  const onSelectionChange = useCallback((key: string) => {
    const [type, id] = key.split('.');
    setSelectedItems((prev) => new Map(prev.set(`${type}.${id}`, key)));
  }, []);

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
