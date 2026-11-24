import type { FC } from 'react';
import React from 'react';

type Custom = 'x' | 'y';

interface Props {
  openUnion?: 'sm' | 'md' | (string & {});
  openIntersection?: string & {};
  closedUnion?: 'a' | 'b';
  withNull?: 'a' | 'b' | null;
  mixedUnion?: 'a' | Custom;
}

export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;
