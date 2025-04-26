import type { FC, PropsWithChildren } from 'react';
import React from 'react';

export const anchorBlockIdFromId = (storyId: string) => `anchor--${storyId}`;

export interface AnchorProps {
  storyId: string;
  /** Optional explicit id for anchor to allow stable permalinks */
  id?: string;
}

export const Anchor: FC<PropsWithChildren<AnchorProps>> = ({ storyId, id, children }) => (
  <div id={id || anchorBlockIdFromId(storyId)} className="sb-anchor">
    {children}
  </div>
);
