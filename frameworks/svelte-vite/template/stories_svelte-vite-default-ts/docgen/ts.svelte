<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LiteralNumbers, LiteralStrings } from './types';
  import { MyEnum } from './types';

  type MyObject = {
    foo: string;
    bar: number;
  };

  type Props = {
    /** Boolean */
    boolean?: boolean;
    /** String */
    string?: string;
    /** String (required) */
    stringRequired: string;
    /** Number */
    number?: number;
    /** True literal */
    trueLiteral?: true | undefined;
    /** Symbol */
    symbol?: symbol | undefined;
    /** Null */
    nullValue?: null;
    /** Undefined */
    undefinedValue?: undefined;
    /** Any */
    any?: any;
    /** Date */
    date?: Date;
    /** Array of numbers */
    arrayOfNumbers?: number[];
    /** Enum */
    enumValue?: MyEnum;
    /** Union of literal strings */
    unionLiteralStrings?: LiteralStrings;
    /** Union of literal numbers */
    unionLiteralNumbers?: LiteralNumbers;
    /** Object */
    object?: MyObject | undefined;
    /** Inline object */
    inlineObject?:
      | {
          foo: string;
          bar: number;
        }
      | undefined;
    /** Record */
    record?: Record<string, number>;
    /** Union of types */
    unionTypes?: number | string;
    /** Intersection of types */
    intersection?: ({ a: number } & { b: string }) | undefined;
    /** Event callback function */
    func?: (event: MouseEvent) => number;
    /** Children */
    children: Snippet;
    /** Actual arg types inferred from the component */
    argTypes: Record<string, any>;
  };

  const {
    boolean = true,
    string = 'default',
    stringRequired,
    number = 123,
    trueLiteral = undefined,
    symbol = undefined,
    nullValue = null,
    undefinedValue = undefined,
    any = null,
    date = new Date('20 Jan 1983'),
    arrayOfNumbers = [1, 20, 300],
    enumValue = MyEnum.FOO,
    unionLiteralStrings = 'apple',
    unionLiteralNumbers = 100,
    object = undefined,
    inlineObject = undefined,
    record = { a: 1, b: 2 },
    unionTypes = 123,
    intersection = undefined,
    func = () => 10,
    children,
    argTypes,
  }: Props = $props();
</script>

<h1>Docgen: TS</h1>

<h2>Args</h2>
<pre>{JSON.stringify(
    {
      boolean,
      string,
      stringRequired,
      number,
      trueLiteral,
      symbol,
      nullValue,
      undefinedValue,
      any,
      date,
      arrayOfNumbers,
      enumValue,
      unionLiteralStrings,
      unionLiteralNumbers,
      object,
      inlineObject,
      record,
      unionTypes,
      intersection,
      func,
    },
    null,
    2
  )}</pre>

<h2>Children</h2>
{#if children}
  {@render children()}
{/if}

<h2>Arg Types</h2>
<pre>{JSON.stringify(argTypes, null, 2)}</pre>
