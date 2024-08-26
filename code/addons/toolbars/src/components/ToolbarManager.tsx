import type { FC } from 'react';
import React from 'react';

import { Separator } from 'storybook/internal/components';
import { useGlobalTypes } from 'storybook/internal/manager-api';

import type { ToolbarArgType } from '../types';
import { normalizeArgType } from '../utils/normalize-toolbar-arg-type';
import { ToolbarMenuList } from './ToolbarMenuList';

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

        return <ToolbarMenuList key={id} id={id} {...normalizedArgType} />;
      })}
    </>
  );
};
