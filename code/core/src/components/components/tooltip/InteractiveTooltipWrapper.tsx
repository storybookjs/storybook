import React, { useMemo } from 'react';

import { TooltipNote, WithTooltip } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { shortcutToHumanString } from '../../../manager-api';
import type { API_KeyCollection } from '../../../manager-api/modules/shortcuts';

const NoMarginNote = styled(TooltipNote)(() => ({
  margin: 0,
}));

// TODO: Improve delay management; make the delay near-instantaneous if any instance of this component has been recently shown.

const InteractiveTooltipWrapper: React.FC<{
  children: React.ReactNode;
  shortcut?: API_KeyCollection;
  tooltip?: string;
}> = ({ children, shortcut, tooltip }) => {
  const tooltipLabel = useMemo(() => {
    if (!tooltip && !shortcut) {
      return undefined;
    }

    return [tooltip, shortcut && `[${shortcutToHumanString(shortcut)}`].filter(Boolean).join(' ');
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

export default InteractiveTooltipWrapper;
