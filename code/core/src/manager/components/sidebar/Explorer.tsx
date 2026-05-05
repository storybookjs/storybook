import type { FC } from 'react';
import React, { useRef } from 'react';

import type { API } from 'storybook/manager-api';

import { useLandmark } from '../../hooks/useLandmark.ts';
import { Ref } from './Refs.tsx';
import type { CombinedDataset, Selection } from './types.ts';

export interface ExplorerProps {
  className?: string;
  api: API;
  docsMode: boolean;
  isLoading: boolean;
  isBrowsing: boolean;
  isHidden: boolean;
  isDevelopment: boolean;
  hasEntries: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

export const Explorer: FC<ExplorerProps> = React.memo(function Explorer({
  api,
  docsMode,
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
      {...landmarkProps}
      {...restProps}
    >
      <h2 id="storybook-explorer-tree-heading" className="sb-sr-only">
        Stories
      </h2>
      {dataset.entries.map(([refId, ref]) => (
        <Ref
          {...ref}
          key={refId}
          api={api}
          docsMode={docsMode}
          isLoading={isLoading}
          isBrowsing={isBrowsing}
          isDevelopment={isDevelopment}
          hasEntries={hasEntries}
          selectedStoryId={selected?.refId === ref.id ? selected.storyId : null}
        />
      ))}
    </nav>
  );
});
