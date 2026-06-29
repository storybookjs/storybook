import type { FC } from 'react';
import React from 'react';

type Kind = 'default' | 'action';
type NullableKind = 'default' | 'action' | null;
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
  nullableKind: NullableKind;
  inlinedNullableUnion: 'default' | 'action' | null;
  inlinedNumericLiteralUnion: 0 | 1;
  enumUnion: EnumUnion;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;
