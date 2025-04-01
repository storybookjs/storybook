<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LiteralNumbers, LiteralStrings } from './types';
  import { MyEnum } from './types';

  type MyObject = {
    foo: string;
    bar: number;
  };

  type PropsA = {
    /** Boolean */
    boolean?: boolean;
    /** String */
    string?: string;
    /** String (required) */
    stringRequired: string;
    /** Number */
    number?: number;
  };
  type PropsB = {
    /** True literal */
    trueLiteral?: true;
    /** Symbol */
    symbol?: symbol;
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
    object?: MyObject;
    /** Inline object */
    inlineObject?: {
      foo: string;
      bar: number;
    };
    /** Record */
    record?: Record<string, number>;
    /** Union of types */
    unionTypes?: number | string;
    /** Intersection of types */
    intersection?: { a: number } & { b: string };
    /** Event callback function */
    func?: (event: MouseEvent) => number;
    /** Snippet contents */
    children: Snippet;
    /** Actual arg types inferred from the component */
    argTypes: Record<string, any>;
  };

  let {
    boolean = true,
    string = 'default',
    stringRequired,
    number = 123,
    nullValue = null,
    arrayOfNumbers = [1, 20, 300],
    enumValue = MyEnum.FOO,
    record = { a: 1, b: 2 },
    date = new Date('20 Jan 1983'),
    unionTypes = 123,
    children,
    func = () => 10,
    argTypes,
  }: PropsA & PropsB = $props();
</script>

<h1>Docgen: TS - referenced prop types</h1>

<h2>Args</h2>
<pre>{JSON.stringify(
    {
      boolean,
      string,
      stringRequired,
      number,
      nullValue,
      arrayOfNumbers,
      enumValue,
      record,
      date,
      unionTypes,
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
