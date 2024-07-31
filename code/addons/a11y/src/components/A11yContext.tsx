import * as React from 'react';
import { themes, convert } from 'storybook/internal/theming';
import type { Result } from 'axe-core';
import { useChannel, useAddonState, useStorybookApi } from 'storybook/internal/manager-api';
import { STORY_CHANGED, STORY_RENDERED } from 'storybook/internal/core-events';
import { HIGHLIGHT } from '@storybook/addon-highlight';
import { ADDON_ID, EVENTS } from '../constants';

export interface Results {
  passes: Result[];
  violations: Result[];
  incomplete: Result[];
}

interface A11yContextStore {
  results: Results;
  setResults: (results: Results) => void;
  highlighted: string[];
  toggleHighlight: (target: string[], highlight: boolean) => void;
  clearHighlights: () => void;
  tab: number;
  setTab: (index: number) => void;
}

const colorsByType = [
  convert(themes.light).color.negative, // VIOLATION,
  convert(themes.light).color.positive, // PASS,
  convert(themes.light).color.warning, // INCOMPLETION,
];

export const A11yContext = React.createContext<A11yContextStore>({
  results: {
    passes: [],
    incomplete: [],
    violations: [],
  },
  setResults: () => {},
  highlighted: [],
  toggleHighlight: () => {},
  clearHighlights: () => {},
  tab: 0,
  setTab: () => {},
});

interface A11yContextProviderProps {
  active: boolean;
}

const defaultResult = {
  passes: [],
  incomplete: [],
  violations: [],
};

export const A11yContextProvider: React.FC<React.PropsWithChildren<A11yContextProviderProps>> = ({
  active,
  ...props
}) => {
  const [results, setResults] = useAddonState<Results>(ADDON_ID, defaultResult);
  const [tab, setTab] = React.useState(0);
  const [highlighted, setHighlighted] = React.useState<string[]>([]);
  const api = useStorybookApi();
  const storyEntry = api.getCurrentStoryData();

  const handleToggleHighlight = React.useCallback((target: string[], highlight: boolean) => {
    setHighlighted((prevHighlighted) =>
      highlight
        ? [...prevHighlighted, ...target]
        : prevHighlighted.filter((t) => !target.includes(t))
    );
  }, []);
  const handleRun = (renderedStoryId: string) => {
    emit(EVENTS.REQUEST, renderedStoryId, api.getParameters(renderedStoryId, 'a11y'));
  };
  const handleClearHighlights = React.useCallback(() => setHighlighted([]), []);
  const handleSetTab = React.useCallback((index: number) => {
    handleClearHighlights();
    setTab(index);
  }, []);

  const handleReset = React.useCallback(() => {
    setTab(0);
    setResults(defaultResult);
    // Highlights is cleared by addon-highlight
  }, []);

  const emit = useChannel({
    [STORY_RENDERED]: handleRun,
    [STORY_CHANGED]: handleReset,
  });

  React.useEffect(() => {
    emit(HIGHLIGHT, { elements: highlighted, color: colorsByType[tab] });
  }, [highlighted, tab]);

  React.useEffect(() => {
    if (active && storyEntry?.type === 'story') {
      handleRun(storyEntry.id);
    } else {
      handleClearHighlights();
    }
  }, [active, handleClearHighlights, emit, storyEntry]);

  if (!active) return null;

  return (
    <A11yContext.Provider
      value={{
        results,
        setResults,
        highlighted,
        toggleHighlight: handleToggleHighlight,
        clearHighlights: handleClearHighlights,
        tab,
        setTab: handleSetTab,
      }}
      {...props}
    />
  );
};

export const useA11yContext = () => React.useContext(A11yContext);
