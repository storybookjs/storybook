import type { FC } from 'react';
import React from 'react';

interface ItemInterface {
  text: string;
  value: string;
}

interface PersonInterface {
  name: string;
}

type InterfaceIntersection = ItemInterface & PersonInterface;

interface GenericInterface<T> {
  value: T;
}

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

type EnumUnion = DefaultEnum | NumericEnum;

type StringLiteralUnion = 'top-left' | 'top-right' | 'top-center';
type NumericLiteralUnion = 0 | 1 | 2;

type StringAlias = string;
type NumberAlias = number;
type AliasesIntersection = StringAlias & NumberAlias;
type AliasesUnion = StringAlias | NumberAlias;
interface GenericAlias<T> {
  value: T;
}

interface TypeScriptPropsProps {
  any: any;
  string: string;
  bool: boolean;
  number: number;
  voidFunc: () => void;
  funcWithArgsAndReturns: (a: string, b: string) => string;
  funcWithunionArg: (a: string | number) => string;
  funcWithMultipleUnionReturns: () => string | ItemInterface;
  funcWithIndexTypes: <T, K extends keyof T>(o: T, propertyNames: K[]) => T[K][];
  symbol: symbol;
  interface: ItemInterface;
  genericInterface: GenericInterface<string>;
  arrayOfPrimitive: string[];
  arrayOfComplexObject: ItemInterface[];
  tupleOfPrimitive: [string, number];
  tupleWithComplexType: [string, ItemInterface];
  defaultEnum: DefaultEnum;
  numericEnum: NumericEnum;
  stringEnum: StringEnum;
  enumUnion: EnumUnion;
  recordOfPrimitive: Record<string, number>;
  recordOfComplexObject: Record<string, ItemInterface>;
  intersectionType: InterfaceIntersection;
  intersectionWithInlineType: ItemInterface & { inlineValue: string };
  unionOfPrimitive: string | number;
  unionOfComplexType: ItemInterface | InterfaceIntersection;
  nullablePrimitive?: string;
  nullableComplexType?: ItemInterface;
  nullableComplexTypeUndefinedDefaultValue?: ItemInterface;
  readonly readonlyPrimitive: string;
  typeAlias: StringAlias;
  aliasesIntersection: AliasesIntersection;
  aliasesUnion: AliasesUnion;
  genericAlias: GenericAlias<string>;
  namedStringLiteralUnion: StringLiteralUnion;
  inlinedStringLiteralUnion: 'bottom-left' | 'bottom-right' | 'bottom-center';
  namedNumericLiteralUnion: NumericLiteralUnion;
  inlinedNumericLiteralUnion: 0 | 1 | 2;
}

export const TypeScriptProps: FC<TypeScriptPropsProps> = (props) => <div>TypeScript!</div>;

export const component = TypeScriptProps;
