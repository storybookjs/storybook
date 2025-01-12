<script>
  /**
   * @typedef {Object} MyObject
   * @property {string} foo
   * @property {number} bar
   */

  /**
   * @typedef {Object} MyProps
   * @property {boolean=} boolean Boolean
   * @property {string=} string String
   * @property {string} stringRequired String (required)
   * @property {number=} number Number
   * @property {true=} trueLiteral True literal
   * @property {symbol=} symbol Symbol
   * @property {null=} nullValue Null
   * @property {undefined=} undefinedValue Undefined
   * @property {any=} any Any
   * @property {import("./types").LiteralStrings=} unionLiteralStrings Union of literal strings
   * @property {import("./types").LiteralNumbers=} unionLiteralNumbers Union of literal numbers
   * @property {MyObject=} object Object
   * @property {{ foo: string, bar: number }=} inlineObject Inline object
   * @property {Record<string, number> =} record Record
   * @property {Date=} date Date
   * @property {number | string =} unionTypes Union of types
   * @property {{ a: number } & { b: string } =} intersection Intersection of types
   * @property {import("svelte").Snippet} children Snippet contents
   * @property {(event: MouseEvent) => number =} func Event callback function
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
    unionLiteralStrings = 'apple',
    unionLiteralNumbers = 1000,
    object = undefined,
    inlineObject = undefined,
    record = { a: 1, b: 2 },
    date = new Date('20 Jan 1983'),
    unionTypes = 123,
    intersection = undefined,
    children,
    func = () => 10,
  } = $props();
</script>

<div>Docs: JSDoc + Runes</div>
