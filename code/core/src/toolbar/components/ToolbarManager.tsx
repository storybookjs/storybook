import React, { type FC, useMemo } from 'react';

import { Separator } from 'storybook/internal/components';

import { useGlobalTypes } from 'storybook/manager-api';

import { normalizeToolbarArgTypes } from '../utils/normalize-toolbar-arg-type.ts';
import { ToolbarMenuSelect } from './ToolbarMenuSelect.tsx';

/** A smart component for handling manager-preview interactions. */
export const ToolbarManager: FC = () => {
  const globalTypes = useGlobalTypes();
  // This renders on every manager commit. Normalizing each time would hand every menu a new `items`
  // array, and the menus re-register their shortcuts when their options change.
  const toolbars = useMemo(() => normalizeToolbarArgTypes(globalTypes), [globalTypes]);

  if (toolbars.length === 0) {
    return null;
  }

  return (
    <>
      <Separator />
      {toolbars.map((toolbar) => (
        <ToolbarMenuSelect key={toolbar.id} {...toolbar} />
      ))}
    </>
  );
};
