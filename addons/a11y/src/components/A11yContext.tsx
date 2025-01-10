import type { FC, PropsWithChildren } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  STORY_FINISHED,
  STORY_RENDER_PHASE_CHANGED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';
import {
  useAddonState,
  useChannel,
  useGlobals,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/internal/manager-api';
import type { Report } from 'storybook/internal/preview-api';
import { convert, themes } from 'storybook/internal/theming';

import { HIGHLIGHT } from '@storybook/addon-highlight';

import type { AxeResults, Result } from 'axe-core';

import { ADDON_ID, EVENTS, TEST_PROVIDER_ID } from '../constants';
import type { A11yParameters } from '../params';
import type { A11YReport } from '../types';
import type { TestDiscrepancy } from './TestDiscrepancyMessage';

export interface Results {
  passes: Result[];
  violations: Result[];
  incomplete: Result[];
}

export interface A11yContextStore {
  results: Results;
  highlighted: string[];
  toggleHighlight: (target: string[], highlight: boolean) => void;
  clearHighlights: () => void;
  tab: number;
  setTab: (index: number) => void;
  status: Status;
  setStatus: (status: Status) => void;
  error: unknown;
  handleManual: () => void;
  discrepancy: TestDiscrepancy;
}

const colorsByType = [
  convert(themes.light).color.negative, // VIOLATION,
  convert(themes.light).color.positive, // PASS,
  convert(themes.light).color.warning, // INCOMPLETION,
];

export const A11yContext = createContext<A11yContextStore>({
  results: {
    passes: [],
    incomplete: [],
    violations: [],
  },
  highlighted: [],
  toggleHighlight: () => {},
  clearHighlights: () => {},
  tab: 0,
  setTab: () => {},
  setStatus: () => {},
  status: 'initial',
  error: undefined,
  handleManual: () => {},
  discrepancy: null,
});

const defaultResult = {
  passes: [],
  incomplete: [],
  violations: [],
};

type Status = 'initial' | 'manual' | 'running' | 'error' | 'ran' | 'ready';

export const A11yContextProvider: FC<PropsWithChildren> = (props) => {
  const parameters = useParameter<A11yParameters>('a11y', {
    manual: false,
  });

  const [globals] = useGlobals() ?? [];

  const getInitialStatus = useCallback((manual = false) => (manual ? 'manual' : 'initial'), []);

  const manual = useMemo(
    () => globals?.a11y?.manual ?? parameters.manual ?? false,
    [globals?.a11y?.manual, parameters.manual]
  );

  const api = useStorybookApi();
  const [results, setResults] = useAddonState<Results>(ADDON_ID, defaultResult);
  const [tab, setTab] = useState(0);
  const [error, setError] = React.useState<unknown>(undefined);
  const [status, setStatus] = useState<Status>(getInitialStatus(manual));
  const [highlighted, setHighlighted] = useState<string[]>([]);

  const { storyId } = useStorybookState();
  const storyStatus = api.getCurrentStoryStatus();

  const handleToggleHighlight = useCallback((target: string[], highlight: boolean) => {
    setHighlighted((prevHighlighted) =>
      highlight
        ? [...prevHighlighted, ...target]
        : prevHighlighted.filter((t) => !target.includes(t))
    );
  }, []);

  const handleClearHighlights = useCallback(() => setHighlighted([]), []);

  const handleSetTab = useCallback(
    (index: number) => {
      handleClearHighlights();
      setTab(index);
    },
    [handleClearHighlights]
  );

  const handleError = useCallback((err: unknown) => {
    setStatus('error');
    setError(err);
  }, []);

  const handleResult = useCallback(
    (axeResults: AxeResults, id: string) => {
      if (storyId === id) {
        setStatus('ran');
        setResults(axeResults);

        setTimeout(() => {
          if (status === 'ran') {
            setStatus('ready');
          }
        }, 900);
      }
    },
    [setResults, status, storyId]
  );

  const handleReport = useCallback(
    ({ reporters }: StoryFinishedPayload) => {
      const a11yReport = reporters.find((r) => r.type === 'a11y') as Report<A11YReport> | undefined;

      if (a11yReport) {
        if ('error' in a11yReport.result) {
          handleError(a11yReport.result.error);
        } else {
          handleResult(a11yReport.result, storyId);
        }
      }
    },
    [handleError, handleResult, storyId]
  );

  const handleReset = useCallback(
    ({ newPhase }: { newPhase: string }) => {
      if (newPhase === 'loading') {
        setResults(defaultResult);
        if (manual) {
          setStatus('manual');
        } else {
          setStatus('running');
        }
      }
    },
    [manual, setResults]
  );

  const emit = useChannel(
    {
      [EVENTS.RESULT]: handleResult,
      [EVENTS.ERROR]: handleError,
      [STORY_RENDER_PHASE_CHANGED]: handleReset,
      [STORY_FINISHED]: handleReport,
    },
    [handleReset, handleReport, handleReset, handleError, handleResult]
  );

  const handleManual = useCallback(() => {
    setStatus('running');
    emit(EVENTS.MANUAL, storyId, parameters);
  }, [emit, parameters, storyId]);

  useEffect(() => {
    setStatus(getInitialStatus(manual));
  }, [getInitialStatus, manual]);

  useEffect(() => {
    emit(HIGHLIGHT, { elements: highlighted, color: colorsByType[tab] });
  }, [emit, highlighted, tab]);

  const discrepancy: TestDiscrepancy = useMemo(() => {
    const storyStatusA11y = storyStatus?.[TEST_PROVIDER_ID]?.status;

    if (storyStatusA11y) {
      if (storyStatusA11y === 'success' && results.violations.length > 0) {
        return 'cliPassedBrowserFailed';
      }

      if (storyStatusA11y === 'error' && results.violations.length === 0) {
        if (status === 'ready' || status === 'ran') {
          return 'browserPassedCliFailed';
        }

        if (status === 'manual') {
          return 'cliFailedButModeManual';
        }
      }
    }

    return null;
  }, [results.violations.length, status, storyStatus]);

  return (
    <A11yContext.Provider
      value={{
        results,
        highlighted,
        toggleHighlight: handleToggleHighlight,
        clearHighlights: handleClearHighlights,
        tab,
        setTab: handleSetTab,
        status,
        setStatus,
        error,
        handleManual,
        discrepancy,
      }}
      {...props}
    />
  );
};

export const useA11yContext = () => useContext(A11yContext);
