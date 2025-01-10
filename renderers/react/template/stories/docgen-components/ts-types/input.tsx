import type { FC } from 'react';
import React from 'react';

function concat(a: string, b: string): string {
  return a + b;
}

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

export const TypeScriptProps: FC<TypeScriptPropsProps> = () => <div>TypeScript!</div>;
TypeScriptProps.defaultProps = {
  any: 'Any value',
  string: 'A string value',
  bool: true,
  number: 5,
  voidFunc: () => {},
  funcWithArgsAndReturns: concat,
  symbol: Symbol('Default symbol'),
  interface: { text: 'foo', value: 'bar' },
  genericInterface: { value: 'A string value' },
  arrayOfPrimitive: ['foo', 'bar'],
  arrayOfComplexObject: [{ text: 'foo', value: 'bar' }],
  tupleOfPrimitive: ['string value', 5],
  tupleWithComplexType: ['string value', { text: 'foo', value: 'bar' }],
  defaultEnum: DefaultEnum.TopRight,
  numericEnum: NumericEnum.TopRight,
  stringEnum: StringEnum.TopRight,
  enumUnion: DefaultEnum.TopLeft,
  recordOfPrimitive: { foo: 1, bar: 2 },
  recordOfComplexObject: { foo: { text: 'bar', value: 'bar2' } },
  intersectionType: { text: 'foo', value: 'bar', name: 'foo-bar' },
  intersectionWithInlineType: { text: 'foo', value: 'bar', inlineValue: 'this is inlined' },
  unionOfPrimitive: 'A string value',
  unionOfComplexType: { text: 'foo', value: 'bar' },
  nullableComplexTypeUndefinedDefaultValue: undefined,
  typeAlias: 'foo',
  aliasesUnion: 'foo',
  genericAlias: { value: 'foo' },
  namedStringLiteralUnion: 'top-right',
  inlinedStringLiteralUnion: 'bottom-right',
  namedNumericLiteralUnion: 0,
  inlinedNumericLiteralUnion: 1,
};

export const component = TypeScriptProps;
