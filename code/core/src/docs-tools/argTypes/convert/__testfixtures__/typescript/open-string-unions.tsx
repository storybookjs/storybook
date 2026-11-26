import type { FC } from 'react';
import React from 'react';

type Custom = 'x' | 'y';

interface Props {
  openUnion?: 'sm' | 'md' | (string & {});
  openIntersection?: string & {};
  openBare?: 'sm' | (string & {});
  openSpacing?: 'sm' | (string & {});
  nullableOpen?: 'a' | null | (string & {});
  unresolvedMixed?: 'a' | Custom | (string & {});
  closedUnion?: 'a' | 'b';
  withNull?: 'a' | 'b' | null;
  mixedUnion?: 'a' | Custom;
  mixedOpen?: 'sm' | 42 | (string & {});
}

export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;
