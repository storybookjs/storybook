import type { FC, PropsWithChildren } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  STORY_FINISHED,
  STORY_RENDER_PHASE_CHANGED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';

import {
  experimental_getStatusStore,
  experimental_useStatusStore,
  useAddonState,
  useChannel,
  useGlobals,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import type { Report } from 'storybook/preview-api';
import { convert, themes } from 'storybook/theming';

import {
  HIGHLIGHT,
  RESET_HIGHLIGHT,
  SCROLL_INTO_VIEW,
} from '../../../../core/src/highlight/constants';
import { ADDON_ID, EVENTS, STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST } from '../constants';
import type { A11yParameters } from '../params';
import type { A11YReport, EnhancedResult, EnhancedResults } from '../types';
import { RuleType } from '../types';
import type { TestDiscrepancy } from './TestDiscrepancyMessage';

export interface A11yContextStore {
  results: EnhancedResults | undefined;
  highlighted: boolean;
  toggleHighlight: () => void;
  tab: RuleType;
  handleCopyLink: (key: string) => void;
  setTab: (type: RuleType) => void;
  status: Status;
  setStatus: (status: Status) => void;
  error: unknown;
  handleManual: () => void;
  discrepancy: TestDiscrepancy;
  selectedItems: Map<string, string>;
  toggleOpen: (event: React.SyntheticEvent<Element>, type: RuleType, item: EnhancedResult) => void;
  allExpanded: boolean;
  handleCollapseAll: () => void;
  handleExpandAll: () => void;
  handleJumpToElement: (target: string) => void;
  handleSelectionChange: (key: string) => void;
}

const colorsByType = {
  [RuleType.VIOLATION]: convert(themes.light).color.negative,
  [RuleType.PASS]: convert(themes.light).color.positive,
  [RuleType.INCOMPLETION]: convert(themes.light).color.warning,
};

export const A11yContext = createContext<A11yContextStore>({
  results: undefined,
  highlighted: false,
  toggleHighlight: () => {},
  tab: RuleType.VIOLATION,
  handleCopyLink: () => {},
  setTab: () => {},
  setStatus: () => {},
  status: 'initial',
  error: undefined,
  handleManual: () => {},
  discrepancy: null,
  selectedItems: new Map(),
  allExpanded: false,
  toggleOpen: () => {},
  handleCollapseAll: () => {},
  handleExpandAll: () => {},
  handleJumpToElement: () => {},
  handleSelectionChange: () => {},
});

type Status = 'initial' | 'manual' | 'running' | 'error' | 'component-test-error' | 'ran' | 'ready';

export const A11yContextProvider: FC<PropsWithChildren> = (props) => {
  const parameters = useParameter<A11yParameters>('a11y', {});

  const [globals] = useGlobals() ?? [];
  const api = useStorybookApi();

  const getInitialStatus = useCallback((manual = false) => (manual ? 'manual' : 'initial'), []);

  const manual = useMemo(() => globals?.a11y?.manual ?? false, [globals?.a11y?.manual]);

  const a11ySelection = useMemo(() => {
    const value = api.getQueryParam('a11ySelection');
    if (value) {
      api.setQueryParams({ a11ySelection: '' });
    }
    return value;
  }, [api]);

  const [results, setResults] = useAddonState<EnhancedResults | undefined>(ADDON_ID);
  const [tab, setTab] = useState(() => {
    const [type] = a11ySelection?.split('.') ?? [];
    return type && Object.values(RuleType).includes(type as RuleType)
      ? (type as RuleType)
      : RuleType.VIOLATION;
  });
  const [error, setError] = useState<unknown>(undefined);
  const [status, setStatus] = useState<Status>(getInitialStatus(manual));
  const [highlighted, setHighlighted] = useState(!!a11ySelection);

  const { storyId } = useStorybookState();
  const currentStoryA11yStatusValue = experimental_useStatusStore(
    (allStatuses) => allStatuses[storyId]?.[STATUS_TYPE_ID_A11Y]?.value
  );

  useEffect(() => {
    const unsubscribe = experimental_getStatusStore('storybook/component-test').onAllStatusChange(
      (statuses, previousStatuses) => {
        const current = statuses[storyId]?.[STATUS_TYPE_ID_COMPONENT_TEST];
        const previous = previousStatuses[storyId]?.[STATUS_TYPE_ID_COMPONENT_TEST];
        if (current?.value === 'status-value:error' && previous?.value !== 'status-value:error') {
          setStatus('component-test-error');
        }
      }
    );
    return unsubscribe;
  }, [storyId]);

  const handleToggleHighlight = useCallback(
    () => setHighlighted((prevHighlighted) => !prevHighlighted),
    []
  );

  const [selectedItems, setSelectedItems] = useState<Map<string, string>>(() => {
    const initialValue = new Map();
    // Check if the a11ySelection param is a valid format before parsing it
    // It should look like `violation.aria-hidden-body.1`
    if (a11ySelection && /^[a-z]+.[a-z-]+.[0-9]+$/.test(a11ySelection)) {
      const [type, id] = a11ySelection.split('.');
      initialValue.set(`${type}.${id}`, a11ySelection);
    }
    return initialValue;
  });

  // All items are expanded if something is selected from each result for the current tab
  const allExpanded = useMemo(() => {
    const currentResults = results?.[tab];
    return currentResults?.every((result) => selectedItems.has(`${tab}.${result.id}`)) ?? false;
  }, [results, selectedItems, tab]);

  const toggleOpen = useCallback(
    (event: React.SyntheticEvent<Element>, type: RuleType, item: EnhancedResult) => {
      event.stopPropagation();
      const key = `${type}.${item.id}`;
      setSelectedItems((prev) => new Map(prev.delete(key) ? prev : prev.set(key, `${key}.1`)));
    },
    []
  );

  const handleCollapseAll = useCallback(() => {
    setSelectedItems(new Map());
  }, []);

  const handleExpandAll = useCallback(() => {
    setSelectedItems(
      (prev) =>
        new Map(
          results?.[tab]?.map((result) => {
            const key = `${tab}.${result.id}`;
            return [key, prev.get(key) ?? `${key}.1`];
          }) ?? []
        )
    );
  }, [results, tab]);

  const handleSelectionChange = useCallback((key: string) => {
    const [type, id] = key.split('.');
    setSelectedItems((prev) => new Map(prev.set(`${type}.${id}`, key)));
  }, []);

  const handleError = useCallback((err: unknown) => {
    setStatus('error');
    setError(err);
  }, []);

  const handleResult = useCallback(
    (axeResults: EnhancedResults, id: string) => {
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
        setResults(undefined);
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

  const handleCopyLink = useCallback(async (linkPath: string) => {
    const { createCopyToClipboardFunction } = await import('storybook/internal/components');
    await createCopyToClipboardFunction()(`${window.location.origin}${linkPath}`);
  }, []);

  const handleJumpToElement = useCallback(
    (target: string) => emit(SCROLL_INTO_VIEW, target),
    [emit]
  );

  useEffect(() => {
    setStatus(getInitialStatus(manual));
  }, [getInitialStatus, manual]);

  useEffect(() => {
    emit(RESET_HIGHLIGHT);
    if (!highlighted) {
      return;
    }

    const selected = Array.from(selectedItems.values()).flatMap((key) => {
      const [type, id, number] = key.split('.');
      const result = results?.[type as RuleType]?.find((r) => r.id === id);
      const target = result?.nodes[Number(number) - 1]?.target;
      return target ? [target] : [];
    });
    const others = results?.[tab as RuleType]
      ?.flatMap((r) => r.nodes.map((n) => n.target))
      .filter((e) => !selected.includes(e));

    if (selected?.length) {
      emit(HIGHLIGHT, {
        elements: selected,
        color: colorsByType[tab],
        width: '2px',
        offset: '0px',
      });
    }
    if (others?.length) {
      emit(HIGHLIGHT, {
        elements: others,
        color: `${colorsByType[tab]}99`,
        style: 'dashed',
        width: '1px',
        offset: '1px',
      });
    }
  }, [emit, highlighted, results, tab, selectedItems]);

  const discrepancy: TestDiscrepancy = useMemo(() => {
    if (!currentStoryA11yStatusValue) {
      return null;
    }
    if (currentStoryA11yStatusValue === 'status-value:success' && results?.violations.length) {
      return 'cliPassedBrowserFailed';
    }

    if (currentStoryA11yStatusValue === 'status-value:error' && !results?.violations.length) {
      if (status === 'ready' || status === 'ran') {
        return 'browserPassedCliFailed';
      }

      if (status === 'manual') {
        return 'cliFailedButModeManual';
      }
    }
    return null;
  }, [results?.violations.length, status, currentStoryA11yStatusValue]);

  return (
    <A11yContext.Provider
      value={{
        results,
        highlighted,
        toggleHighlight: handleToggleHighlight,
        tab,
        setTab,
        handleCopyLink,
        status,
        setStatus,
        error,
        handleManual,
        discrepancy,
        selectedItems,
        toggleOpen,
        allExpanded,
        handleCollapseAll,
        handleExpandAll,
        handleJumpToElement,
        handleSelectionChange,
      }}
      {...props}
    />
  );
};

export const useA11yContext = () => useContext(A11yContext);
