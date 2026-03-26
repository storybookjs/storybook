import React, { type FC } from 'react';

import { Separator } from 'storybook/internal/components';

import { useGlobalTypes } from 'storybook/manager-api';

import { normalizeArgType } from '../utils/normalize-toolbar-arg-type';
import { ToolbarMenuSelect } from './ToolbarMenuSelect';

/** A smart component for handling manager-preview interactions. */
export const ToolbarManager: FC = () => {
  const globalTypes = useGlobalTypes();
  const hasToolbars = Object.keys(globalTypes).some((id) => !!globalTypes[id].toolbar);

  if (!hasToolbars) {
    return null;
  }

  return (
    <>
      <Separator />
      {Object.keys(globalTypes).map((id) => {
        const normalizedArgType = normalizeArgType(id, globalTypes[id]);

        return normalizedArgType && <ToolbarMenuSelect key={id} id={id} {...normalizedArgType} />;
      })}
    </>
  );
};
