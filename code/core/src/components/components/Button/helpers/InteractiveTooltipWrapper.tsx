import React, { type DOMAttributes, type ReactElement, useMemo } from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/manager-api';

import type { PopperPlacement } from '../../shared/overlayHelpers.tsx';
import { TooltipNote } from '../../tooltip/TooltipNote.tsx';
import { TooltipProvider } from '../../tooltip/TooltipProvider.tsx';

export const InteractiveTooltipWrapper: React.FC<{
  children: ReactElement<DOMAttributes<Element>, string>;
  shortcut?: API_KeyCollection;
  disableAllTooltips?: boolean;
  tooltip?: string;
  tooltipPlacement?: PopperPlacement;
}> = ({ children, disableAllTooltips, shortcut, tooltip, tooltipPlacement = 'top' }) => {
  const shortcutLabel = useMemo(() => {
    if (!shortcut) {
      return undefined;
    }

    // Read the flag from the DOM instead of the manager API. Button is public API and can be
    // imported in MDX, where the addons singleton is not available. The flag does not change in
    // the app's lifecycle, so it's safe to use without reactivity.
    const hasShortcuts = document?.body?.getAttribute('data-shortcuts-enabled') !== 'false';
    if (!hasShortcuts) {
      return undefined;
    }

    return shortcutToHumanString(shortcut);
  }, [shortcut]);

  // Show a tooltip for the shortcut alone. When a Button sets no `tooltip`, we still
  // need to show it for the shortcut to be discoverable.
  return tooltip || shortcutLabel ? (
    <TooltipProvider
      placement={tooltipPlacement}
      tooltip={<TooltipNote note={tooltip} shortcut={shortcutLabel} />}
      visible={!disableAllTooltips ? undefined : false}
    >
      {children}
    </TooltipProvider>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
