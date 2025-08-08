import React, { useMemo } from 'react';

import { styled } from 'storybook/theming';

import { shortcutToHumanString } from '../../../manager-api';
import type { API_KeyCollection } from '../../../manager-api/modules/shortcuts';
import { TooltipNote } from './TooltipNote';
import { WithTooltip } from './WithTooltip';

const NoMarginNote = styled(TooltipNote)(() => ({
  margin: 0,
}));

// TODO: Improve delay management; make the delay near-instantaneous if any instance of this component has been recently shown.
// TODO: Find way to trigger the tooltip when the child component is focused too. Will need this for general a11y but particularly for Sidebar nav secondary actions.

export const InteractiveTooltipWrapper: React.FC<{
  children: React.ReactNode;
  shortcut?: API_KeyCollection;
  tooltip?: string;
}> = ({ children, shortcut, tooltip }) => {
  const tooltipLabel = useMemo(() => {
    if (!tooltip && !shortcut) {
      return undefined;
    }

    return [tooltip, shortcut && `[${shortcutToHumanString(shortcut)}]`].filter(Boolean).join(' ');
  }, [shortcut, tooltip]);

  return tooltipLabel ? (
    <WithTooltip trigger="hover" hasChrome={false} tooltip={<NoMarginNote note={tooltipLabel} />}>
      {children}
    </WithTooltip>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
