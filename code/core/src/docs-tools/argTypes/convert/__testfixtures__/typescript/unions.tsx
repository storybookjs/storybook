import type { FC } from 'react';
import React from 'react';

type Kind = 'default' | 'action';
enum DefaultEnum {
  TopLeft,
  TopRight,
  TopCenter,
}
enum NumericEnum {
  TopLeft = 0,
  TopRight,
  TopCenter,
}
type EnumUnion = DefaultEnum | NumericEnum;
interface Props {
  kind?: Kind;
  inlinedNumericLiteralUnion: 0 | 1;
  nullableUnion: string | number | null;
  nullableLiteralUnion: 'default' | 1 | null;
  enumUnion: EnumUnion;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;
