<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LiteralNumbers, LiteralStrings } from './types';
  import { MyEnum } from './types';

  type MyObject = {
    foo: string;
    bar: number;
  };

  type PropsA = {
    /**
     * Boolean
     */
    boolean?: boolean;
    /**
     * String
     */
    string?: string;
    /**
     * String (required)
     */
    stringRequired: string;
    /**
     * Number
     */
    number?: number;
  };
  type PropsB = {
    /**
     * True literal
     */
    trueLiteral?: true;
    /**
     * Symbol
     */
    symbol?: symbol;
    /**
     * Null
     */
    nullValue?: null;
    /**
     * Undefined
     */
    undefinedValue?: undefined;
    /**
     * Any
     */
    any?: any;
    /**
     * Array of numbers
     */
    arrayOfNumbers?: number[];
    /**
     * Enum
     */
    enumValue?: MyEnum;
    /**
     * Union of literal strings
     */
    unionLiteralStrings?: LiteralStrings;
    /**
     * Union of literal numbers
     */
    unionLiteralNumbers?: LiteralNumbers;
    /**
     * Object
     */
    object?: MyObject;
    /**
     * Inline object
     */
    inlineObject?: {
      foo: string;
      bar: number;
    };
    /**
     * Record
     */
    record?: Record<string, number>;
    /**
     * Date
     */
    date?: Date;
    /**
     * Union of types
     */
    unionTypes?: number | string;
    /**
     * Intersection of types
     */
    intersection?: { a: number } & { b: string };
    /**
     * Snippet contents
     */
    children: Snippet;
    /**
     * Event callback function
     */
    func?: (event: MouseEvent) => number;
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
    func = () => 10,
  }: PropsA & PropsB = $props();
</script>

<div>Docs: TS + Runes (referenced prop types)</div>
