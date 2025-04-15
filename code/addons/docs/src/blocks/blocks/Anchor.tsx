import type { FC, PropsWithChildren } from 'react';
import React from 'react';

export const anchorBlockIdFromId = (storyId: string) => `anchor--${storyId}`;

export interface AnchorProps {
  storyId: string;
}

export const Anchor: FC<PropsWithChildren<AnchorProps>> = ({ storyId, children }) => (
  <div id={anchorBlockIdFromId(storyId)} className="sb-anchor">
    {children}
  </div>
);
