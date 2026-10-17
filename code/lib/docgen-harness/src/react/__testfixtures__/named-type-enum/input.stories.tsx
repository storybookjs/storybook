import React from 'react';
import { Color } from './color';
import { StatusBadge } from './StatusBadge';

export default {
  component: StatusBadge,
  title: 'React/NamedTypeEnum',
};

export const Primary = () => <StatusBadge status={Color.Red} />;
