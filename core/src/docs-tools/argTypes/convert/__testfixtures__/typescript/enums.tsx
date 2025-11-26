import type { FC } from 'react';
import React from 'react';

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
enum StringEnum {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  TopCenter = 'top-center',
}
interface Props {
  defaultEnum: DefaultEnum;
  numericEnum: NumericEnum;
  stringEnum: StringEnum;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;
