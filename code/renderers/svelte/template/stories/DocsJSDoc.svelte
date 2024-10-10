<script>
  /**
   * @typedef {100 | 1000 | 10000} LiteralNumbers
   */

  /**
   * @typedef {"apple" | "grape" | "orange"} LiteralStrings
   */

  /**
   * @typedef {Object} MyObject
   * @property {string} foo
   * @property {number} bar
   */

  /**
   * @type {boolean} Boolean
   */
  export let boolean = true;
  /**
   * @type {string} String
   */
  export let string = 'default';
  /**
   * @type {string} String (required)
   */
  export let stringRequired;
  /**
   * @type {number} Number
   */
  export let number = 123;
  /**
   * True literal
   * @type {true=}
   */
  export let trueLiteral = undefined;
  /**
   * Null
   * @type {null}
   */
  export let nullValue = null;
  /**
   * Undefined
   * @type {undefined}
   */
  export let undefinedValue = undefined;
  /**
   * Any
   * @type {any}
   */
  export let any = null;
  /**
   * Array of numbers
   * @type {number[]}
   */
  export let arrayOfNumbers = [1, 20, 300];
  /**
   * Union of literal strings
   * @type {LiteralStrings=}
   */
  export let unionLiteralStrings = 'apple';
  /**
   * Union of literal numbers
   * @type {LiteralNumbers=}
   */
  export let unionLiteralNumbers = 1000;
  /**
   * @type {MyObject=} Object
   */
  export let object = undefined;
  /**
   * Inline object
   * @type {{ foo: string; bar: number } =}
   */
  export let inlineObject = undefined;
  /**
   * Record
   * @type {Record<string, number>}
   */
  export let record = { a: 1, b: 2 };
  /**
   * Date
   * @type {Date}
   */
  export let date = new Date('20 Jan 1983');
  /**
   * Union of types
   * @type {number | string =}
   */
  export let unionTypes = 123;
  /**
   * Intersection of types
   * @type {{ a: number } & { b: string } =}
   */
  export let intersection = undefined;
  /**
   * Event callback function
   * @type {(event: MouseEvent) => number}
   */
  export let func = () => 10;
</script>

<div>Docs: JSDoc</div>
