import React, { type DOMAttributes, type ReactElement, useMemo } from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/manager-api';

import type { PopperPlacement } from '../../shared/overlayHelpers.tsx';
import { TooltipNote } from '../../tooltip/TooltipNote.tsx';
import { TooltipProvider } from '../../tooltip/TooltipProvider.tsx';
import { useShortcutsEnabled } from './useShortcutsEnabled.ts';

export const InteractiveTooltipWrapper: React.FC<{
  children: ReactElement<DOMAttributes<Element>, string>;
  shortcut?: API_KeyCollection;
  disableAllTooltips?: boolean;
  tooltip?: string;
  tooltipPlacement?: PopperPlacement;
}> = ({ children, disableAllTooltips, shortcut, tooltip, tooltipPlacement = 'top' }) => {
  const shortcutsEnabled = useShortcutsEnabled();
  const shortcutLabel = useMemo(
    () => (shortcut && shortcutsEnabled ? shortcutToHumanString(shortcut) : undefined),
    [shortcut, shortcutsEnabled]
  );

  // A shortcut alone still warrants a tooltip: buttons with visible text pass no `tooltip`
  // but their shortcut is only discoverable here.
  return tooltip || shortcutLabel ? (
    <TooltipProvider
      placement={tooltipPlacement}
      tooltip={<TooltipNote note={tooltip} shortcut={shortcutLabel} />}
      disabled={disableAllTooltips}
    >
      {/* @ts-expect-error: Only null prevents React Aria from describing the button with redundant tooltip text. */}
      {React.cloneElement(children, { 'aria-describedby': null })}
    </TooltipProvider>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
