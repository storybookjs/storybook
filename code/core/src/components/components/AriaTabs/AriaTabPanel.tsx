import type { FC } from 'react';
import React, { useRef } from 'react';

import { useTabPanel } from 'react-aria';
import type { TabListState } from 'react-stately';

export interface AriaTabPanelProps {
  /** The state of the tab list. Primary mechanism for using the tabpanel. */
  state: TabListState<object>;
}

export const AriaTabPanel: FC<AriaTabPanelProps> = ({ state }) => {
  const ref = useRef(null);
  const { tabPanelProps } = useTabPanel({}, state, ref);
  return (
    <div key={state.selectedItem?.key} ref={ref} {...tabPanelProps}>
      {state.selectedItem?.props.children}
    </div>
  );
};
