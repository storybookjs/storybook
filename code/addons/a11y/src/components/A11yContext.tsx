import type { FC, PropsWithChildren } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  STORY_CHANGED,
  STORY_FINISHED,
  STORY_HOT_UPDATED,
  STORY_RENDER_PHASE_CHANGED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';

import type { ClickEventDetails, HighlightMenuItem } from 'storybook/highlight';
import { HIGHLIGHT, REMOVE_HIGHLIGHT, SCROLL_INTO_VIEW } from 'storybook/highlight';
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

import { getFriendlySummaryForAxeResult, getTitleForAxeResult } from '../axeRuleMappingHelper';
import { ADDON_ID, EVENTS, STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST } from '../constants';
import type { A11yParameters } from '../params';
import type { A11YReport, EnhancedResult, EnhancedResults, Status } from '../types';
import { RuleType } from '../types';
import type { TestDiscrepancy } from './TestDiscrepancyMessage';

// These elements should not be highlighted because they usually cover the whole page.
// They may still appear in the results and be selectable though.
const unhighlightedSelectors = ['html', 'body', 'main'];

export interface A11yContextStore {
  parameters: A11yParameters;
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

const theme = convert(themes.light);
const colorsByType = {
  [RuleType.VIOLATION]: theme.color.negative,
  [RuleType.PASS]: theme.color.positive,
  [RuleType.INCOMPLETION]: theme.color.warning,
};

export const A11yContext = createContext<A11yContextStore>({
  parameters: {},
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

  const [state, setState] = useAddonState<{
    ui: { highlighted: boolean; tab: RuleType };
    results: EnhancedResults | undefined;
    error: unknown;
    status: Status;
  }>(ADDON_ID, {
    ui: {
      highlighted: false,
      tab: RuleType.VIOLATION,
    },
    results: undefined,
    error: undefined,
    status: getInitialStatus(manual),
  });

  const { ui, results, error, status } = state;

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
          setState((prev) => ({ ...prev, status: 'component-test-error' }));
        }
      }
    );
    return unsubscribe;
  }, [setState, storyId]);

  const handleToggleHighlight = useCallback(() => {
    setState((prev) => ({ ...prev, ui: { ...prev.ui, highlighted: !prev.ui.highlighted } }));
  }, [setState]);

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
    const currentResults = results?.[ui.tab];
    return currentResults?.every((result) => selectedItems.has(`${ui.tab}.${result.id}`)) ?? false;
  }, [results, selectedItems, ui.tab]);

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
          results?.[ui.tab]?.map((result) => {
            const key = `${ui.tab}.${result.id}`;
            return [key, prev.get(key) ?? `${key}.1`];
          }) ?? []
        )
    );
  }, [results, ui.tab]);

  const handleSelectionChange = useCallback((key: string) => {
    const [type, id] = key.split('.');
    setSelectedItems((prev) => new Map(prev.set(`${type}.${id}`, key)));
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      setState((prev) => ({ ...prev, status: 'error', error: err }));
    },
    [setState]
  );

  const handleResult = useCallback(
    (axeResults: EnhancedResults, id: string) => {
      if (storyId === id) {
        setState((prev) => ({ ...prev, status: 'ran', results: axeResults }));

        setTimeout(() => {
          setState((prev) => {
            if (prev.status === 'ran') {
              return { ...prev, status: 'ready' };
            }
            return prev;
          });
          setSelectedItems((prev) => {
            if (prev.size === 1) {
              const [key] = prev.values();
              document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return prev;
          });
        }, 900);
      }
    },
    [storyId, setState, setSelectedItems]
  );

  const handleSelect = useCallback(
    (itemId: string, details: ClickEventDetails) => {
      const [type, id] = itemId.split('.');
      const { helpUrl, nodes } = results?.[type as RuleType]?.find((r) => r.id === id) || {};
      const openedWindow = helpUrl && window.open(helpUrl, '_blank', 'noopener,noreferrer');
      if (nodes && !openedWindow) {
        const index =
          nodes.findIndex((n) => details.selectors.some((s) => s === String(n.target))) ?? -1;
        if (index !== -1) {
          const key = `${type}.${id}.${index + 1}`;
          setSelectedItems(new Map([[`${type}.${id}`, key]]));
          setTimeout(() => {
            document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    },
    [results]
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
        setState((prev) => ({
          ...prev,
          results: undefined,
          status: manual ? 'manual' : 'initial',
        }));
      } else if (newPhase === 'afterEach' && !manual) {
        setState((prev) => ({ ...prev, status: 'running' }));
      }
    },
    [manual, setState]
  );

  const emit = useChannel(
    {
      [EVENTS.RESULT]: handleResult,
      [EVENTS.ERROR]: handleError,
      [EVENTS.SELECT]: handleSelect,
      [STORY_CHANGED]: () => setSelectedItems(new Map()),
      [STORY_RENDER_PHASE_CHANGED]: handleReset,
      [STORY_FINISHED]: handleReport,
      [STORY_HOT_UPDATED]: () => {
        setState((prev) => ({ ...prev, status: 'running' }));
        emit(EVENTS.MANUAL, storyId, parameters);
      },
    },
    [handleReset, handleReport, handleSelect, handleError, handleResult, parameters, storyId]
  );

  const handleManual = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'running' }));
    emit(EVENTS.MANUAL, storyId, parameters);
  }, [emit, parameters, setState, storyId]);

  const handleCopyLink = useCallback(async (linkPath: string) => {
    const { createCopyToClipboardFunction } = await import('storybook/internal/components');
    await createCopyToClipboardFunction()(`${window.location.origin}${linkPath}`);
  }, []);

  const handleJumpToElement = useCallback(
    (target: string) => emit(SCROLL_INTO_VIEW, target),
    [emit]
  );

  useEffect(() => {
    setState((prev) => ({ ...prev, status: getInitialStatus(manual) }));
  }, [getInitialStatus, manual, setState]);

  const isInitial = status === 'initial';

  // If a deep link is provided, prefer it once on mount and persist UI state accordingly
  useEffect(() => {
    if (!a11ySelection) {
      return;
    }
    setState((prev) => {
      const update = { ...prev.ui, highlighted: true };

      const [type] = a11ySelection.split('.') ?? [];
      if (type && Object.values(RuleType).includes(type as RuleType)) {
        update.tab = type as RuleType;
      }
      return { ...prev, ui: update };
    });

    // We intentionally do not include setState in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a11ySelection]);

  useEffect(() => {
    emit(REMOVE_HIGHLIGHT, `${ADDON_ID}/selected`);
    emit(REMOVE_HIGHLIGHT, `${ADDON_ID}/others`);

    if (!ui.highlighted || isInitial) {
      return;
    }

    const selected = Array.from(selectedItems.values()).flatMap((key) => {
      const [type, id, number] = key.split('.');
      if (type !== ui.tab) {
        return [];
      }
      const result = results?.[type as RuleType]?.find((r) => r.id === id);
      const target = result?.nodes[Number(number) - 1]?.target;
      return target ? [String(target)] : [];
    });
    if (selected.length) {
      emit(HIGHLIGHT, {
        id: `${ADDON_ID}/selected`,
        priority: 1,
        selectors: selected,
        styles: {
          outline: `1px solid color-mix(in srgb, ${colorsByType[ui.tab]}, transparent 30%)`,
          backgroundColor: 'transparent',
        },
        hoverStyles: {
          outlineWidth: '2px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        menu: results?.[ui.tab as RuleType].map<HighlightMenuItem[]>((result) => {
          const selectors = result.nodes
            .flatMap((n) => n.target)
            .map(String)
            .filter((e) => selected.includes(e));
          return [
            {
              id: `${ui.tab}.${result.id}:info`,
              title: getTitleForAxeResult(result),
              description: getFriendlySummaryForAxeResult(result),
              selectors,
            },
            {
              id: `${ui.tab}.${result.id}`,
              iconLeft: 'info',
              iconRight: 'shareAlt',
              title: 'Learn how to resolve this violation',
              clickEvent: EVENTS.SELECT,
              selectors,
            },
          ];
        }),
      });
    }

    const others = results?.[ui.tab as RuleType]
      .flatMap((r) => r.nodes.flatMap((n) => n.target).map(String))
      .filter((e) => ![...unhighlightedSelectors, ...selected].includes(e));
    if (others?.length) {
      emit(HIGHLIGHT, {
        id: `${ADDON_ID}/others`,
        selectors: others,
        styles: {
          outline: `1px solid color-mix(in srgb, ${colorsByType[ui.tab]}, transparent 30%)`,
          backgroundColor: `color-mix(in srgb, ${colorsByType[ui.tab]}, transparent 60%)`,
        },
        hoverStyles: {
          outlineWidth: '2px',
        },
        focusStyles: {
          backgroundColor: 'transparent',
        },
        menu: results?.[ui.tab as RuleType].map<HighlightMenuItem[]>((result) => {
          const selectors = result.nodes
            .flatMap((n) => n.target)
            .map(String)
            .filter((e) => !selected.includes(e));
          return [
            {
              id: `${ui.tab}.${result.id}:info`,
              title: getTitleForAxeResult(result),
              description: getFriendlySummaryForAxeResult(result),
              selectors,
            },
            {
              id: `${ui.tab}.${result.id}`,
              iconLeft: 'info',
              iconRight: 'shareAlt',
              title: 'Learn how to resolve this violation',
              clickEvent: EVENTS.SELECT,
              selectors,
            },
          ];
        }),
      });
    }
  }, [isInitial, emit, ui.highlighted, results, ui.tab, selectedItems]);

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
        parameters,
        results,
        highlighted: ui.highlighted,
        toggleHighlight: handleToggleHighlight,
        tab: ui.tab,
        setTab: useCallback(
          (type: RuleType) => setState((prev) => ({ ...prev, ui: { ...prev.ui, tab: type } })),
          [setState]
        ),
        handleCopyLink,
        status: status,
        setStatus: useCallback(
          (status: Status) => setState((prev) => ({ ...prev, status })),
          [setState]
        ),
        error: error,
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
