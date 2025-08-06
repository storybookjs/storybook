import type { FC } from 'react';
import React from 'react';

interface Props {
  nullableUnion: string | null | number;
  explicitNull: null;
  booleanOrNull: boolean | null;
}

export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;