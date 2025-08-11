import React, { type FC } from 'react';

import { Separator } from 'storybook/internal/components';

import { useGlobalTypes } from 'storybook/manager-api';

import type { ToolbarArgType } from '../types';
import { normalizeArgType } from '../utils/normalize-toolbar-arg-type';
import { ToolbarMenuSelect } from './ToolbarMenuSelect';

/** A smart component for handling manager-preview interactions. */
export const ToolbarManager: FC = () => {
  const globalTypes = useGlobalTypes();
  const globalIds = Object.keys(globalTypes).filter((id) => !!globalTypes[id].toolbar);

  if (!globalIds.length) {
    return null;
  }

  return (
    <>
      <Separator />
      {globalIds.map((id) => {
        const normalizedArgType = normalizeArgType(id, globalTypes[id] as ToolbarArgType);

        return <ToolbarMenuSelect key={id} id={id} {...normalizedArgType} />;
      })}
    </>
  );
};
