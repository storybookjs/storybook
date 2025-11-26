<script>
  /**
   * @typedef {Object} MyObject
   * @property {string} foo
   * @property {number} bar
   */

  /**
   * @typedef {Object} MyProps
   * @property {boolean} [boolean] Boolean
   * @property {string} [string] String
   * @property {string} stringRequired String (required)
   * @property {number} [number] Number
   * @property {true} [trueLiteral] True literal
   * @property {symbol} [symbol] Symbol
   * @property {null} [nullValue] Null
   * @property {undefined} [undefinedValue] Undefined
   * @property {any} [any] Any
   * @property {Date} [date] Date
   * @property {import('./types').LiteralStrings} [unionLiteralStrings] Union of literal strings
   * @property {import('./types').LiteralNumbers} [unionLiteralNumbers] Union of literal numbers
   * @property {MyObject} [object] Object
   * @property {{ foo: string; bar: number }} [inlineObject] Inline object
   * @property {Record<string, number>} [record] Record
   * @property {number | string} [unionTypes] Union of types
   * @property {{ a: number } & { b: string }} [intersection] Intersection of types
   * @property {(event: MouseEvent) => number} [func] Event callback function
   * @property {import('svelte').Snippet} children Snippet contents
   * @property {Record<string, any>} [argTypes] Actual arg types inferred from the component
   */

  /** @type {MyProps} */
  let {
    boolean = true,
    string = 'default',
    stringRequired,
    number = 123,
    trueLiteral = undefined,
    symbol = undefined,
    nullValue = null,
    undefinedValue = undefined,
    any = undefined,
    date = new Date('20 Jan 1983'),
    unionLiteralStrings = 'apple',
    unionLiteralNumbers = 1000,
    object = undefined,
    inlineObject = undefined,
    record = { a: 1, b: 2 },
    unionTypes = 123,
    intersection = undefined,
    func = () => 10,
    children,
    argTypes,
  } = $props();
</script>

<h1>Docgen: JS - JSDoc</h1>

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
      unionLiteralStrings,
      unionLiteralNumbers,
      object,
      inlineObject,
      record,
      unionTypes,
      intersection,
      func,
      argTypes,
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
