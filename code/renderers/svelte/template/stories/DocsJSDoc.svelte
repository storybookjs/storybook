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
   * @typedef {Object} Props
   * @property {boolean} [boolean] Boolean
   * @property {string} [string] String
   * @property {string} stringRequired String (required)
   * @property {number} [number] Number
   * @property {true} [trueLiteral] True literal
   * @property {null} [nullValue] Null
   * @property {undefined} [undefinedValue] Undefined
   * @property {any} [any] Any
   * @property {number[]} [arrayOfNumbers] Array of numbers
   * @property {LiteralStrings} [unionLiteralStrings] Union of literal strings
   * @property {LiteralNumbers} [unionLiteralNumbers] Union of literal numbers
   * @property {MyObject} [object] Object
   * @property {{ foo: string; bar: number }} [inlineObject] Inline object
   * @property {Record<string, number>} [record] Record
   * @property {Date} [date] Date
   * @property {number | string} [unionTypes] Union of types
   * @property {{ a: number } & { b: string }} [intersection] Intersection of types
   * @property {(event: MouseEvent) => number} [func] Event callback function
   */

  /** @type {Props} */
  const {
    boolean = true,
    string = 'default',
    stringRequired,
    number = 123,
    trueLiteral = undefined,
    nullValue = null,
    undefinedValue = undefined,
    any = null,
    arrayOfNumbers = [1, 20, 300],
    unionLiteralStrings = 'apple',
    unionLiteralNumbers = 1000,
    object = undefined,
    inlineObject = undefined,
    record = { a: 1, b: 2 },
    date = new Date('20 Jan 1983'),
    unionTypes = 123,
    intersection = undefined,
    func = () => 10
  } = $props();
</script>

<div>Docs: JSDoc</div>
