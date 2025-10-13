<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LiteralNumbers, LiteralStrings } from './types';
  import { MyEnum } from './types';

  type MyObject = {
    foo: string;
    bar: number;
  };

  /** Boolean */
  export let boolean: boolean = true;
  /** String */
  export let string: string = 'default';
  /** String (required) */
  export let stringRequired: string;
  /** Number */
  export let number: number = 123;
  /** True literal */
  export let trueLiteral: true | undefined = undefined;
  /** Symbol */
  export let symbol: symbol | undefined = undefined;
  /** Null */
  export let nullValue: null = null;
  /** Undefined */
  export let undefinedValue: undefined = undefined;
  /** Any */
  export let any: any = null;
  /** Date */
  export let date: Date = new Date('20 Jan 1983');
  /** Array of numbers */
  export let arrayOfNumbers: number[] = [1, 20, 300];
  /** Enum */
  export let enumValue: MyEnum = MyEnum.FOO;
  /** Union of literal strings */
  export let unionLiteralStrings: LiteralStrings = 'apple';
  /** Union of literal numbers */
  export let unionLiteralNumbers: LiteralNumbers = 1000;
  /** Object */
  export let object: MyObject | undefined = undefined;
  /** Inline object */
  export let inlineObject:
    | {
        foo: string;
        bar: number;
      }
    | undefined = undefined;
  /** Record */
  export let record: Record<string, number> = { a: 1, b: 2 };
  /** Union of types */
  export let unionTypes: number | string = 123;
  /** Intersection of types */
  export let intersection: ({ a: number } & { b: string }) | undefined = undefined;
  /** Event callback function */
  export let func: (event: MouseEvent) => number = () => 10;
  /** Snippet contents */
  export let children: Snippet;
  /** Actual arg types inferred from the component */
  export let argTypes: Record<string, any> = {};
</script>

<h1>Docgen: TS - legacy</h1>

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
