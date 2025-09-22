import React, { type DOMAttributes, type ReactElement, useMemo } from 'react';

import { TooltipNote, WithTooltip } from 'storybook/internal/components';
import { shortcutToHumanString } from 'storybook/internal/manager-api';
import type { API_KeyCollection } from 'storybook/internal/manager-api';

export const InteractiveTooltipWrapper: React.FC<{
  children: ReactElement<DOMAttributes<Element>, string>;
  shortcut?: API_KeyCollection;
  tooltip?: string;
}> = ({ children, shortcut, tooltip }) => {
  const tooltipLabel = useMemo(() => {
    // We read from document despite the lack of reactivity, because this
    // option isn't changeable in the UI. If it was, we'd need to fetch the
    // addons singleton. This component is used in Buttons, etc., which are
    // public API and can be imported in MDX. So We rely on a declarative
    // DOM attribute instead of relying on the manager API.
    const hasShortcuts = document?.body?.getAttribute('data-shortcuts-enabled') !== 'false';

    if (!tooltip && (!shortcut || !hasShortcuts)) {
      return undefined;
    }

    return [tooltip, shortcut && hasShortcuts && `[${shortcutToHumanString(shortcut)}]`]
      .filter(Boolean)
      .join(' ');
  }, [shortcut, tooltip]);

  return tooltipLabel ? (
    <WithTooltip placement="top" tooltip={<TooltipNote note={tooltipLabel} />}>
      {children}
    </WithTooltip>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
