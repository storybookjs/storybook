import React, { type FC } from 'react';

import { Separator } from '@storybook/ui/internal/components';

import { useGlobalTypes } from '@storybook/manager/manager-api';

import { normalizeArgType } from '../../../shared/toolbar/utils/normalize-toolbar-arg-type.ts';
import { ToolbarMenuSelect } from '../../../shared/toolbar/components/ToolbarMenuSelect.tsx';

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
