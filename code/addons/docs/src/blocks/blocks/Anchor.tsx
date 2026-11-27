import type { FC, PropsWithChildren } from 'react';
import React from 'react';

import { anchorBlockIdFromId } from 'storybook/internal/docs-tools';

export { anchorBlockIdFromId };

export interface AnchorProps {
  storyId: string;
}

export const Anchor: FC<PropsWithChildren<AnchorProps>> = ({ storyId, children }) => (
  <div id={anchorBlockIdFromId(storyId)} className="sb-anchor">
    {children}
  </div>
);
