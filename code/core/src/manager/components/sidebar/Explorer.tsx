import type { FC } from 'react';
import React, { useRef } from 'react';

import { useLandmark } from '../../hooks/useLandmark.ts';
import { HighlightStyles } from './HighlightStyles.tsx';
import { Ref } from './Refs.tsx';
import type { CombinedDataset, Selection } from './types.ts';
import { useHighlighted } from './useHighlighted.ts';

export interface ExplorerProps {
  className?: string;
  isLoading: boolean;
  isBrowsing: boolean;
  isHidden: boolean;
  isDevelopment: boolean;
  hasEntries: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

export const Explorer: FC<ExplorerProps> = React.memo(function Explorer({
  hasEntries,
  isLoading,
  isBrowsing,
  isHidden,
  isDevelopment,
  dataset,
  selected,
  ...restProps
}) {
  const containerRef = useRef<HTMLElement>(null);

  // Track highlighted nodes, keep it in sync with props and enable keyboard navigation
  const [highlighted, setHighlighted, highlightedRef] = useHighlighted({
    containerRef,
    isLoading,
    isBrowsing,
    selected,
  });

  const { landmarkProps } = useLandmark(
    { 'aria-labelledby': 'storybook-explorer-tree-heading', role: 'navigation' },
    containerRef
  );

  return (
    <nav
      hidden={isHidden || undefined}
      aria-hidden={isHidden || undefined}
      className={isBrowsing ? undefined : 'sb-sr-only'}
      ref={containerRef}
      id="storybook-explorer-tree"
      data-highlighted-ref-id={highlighted?.refId}
      data-highlighted-item-id={highlighted?.itemId}
      {...landmarkProps}
      {...restProps}
    >
      <h2 id="storybook-explorer-tree-heading" className="sb-sr-only">
        Stories
      </h2>
      {highlighted && <HighlightStyles {...highlighted} />}
      {dataset.entries.map(([refId, ref]) => (
        <Ref
          {...ref}
          key={refId}
          isLoading={isLoading}
          isBrowsing={isBrowsing}
          isDevelopment={isDevelopment}
          hasEntries={hasEntries}
          selectedStoryId={selected?.refId === ref.id ? selected.storyId : null}
          highlightedRef={highlightedRef}
          setHighlighted={setHighlighted}
        />
      ))}
    </nav>
  );
});
