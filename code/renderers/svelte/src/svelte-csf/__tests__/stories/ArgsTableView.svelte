<script>
  /** @typedef {object} TypeA */
  /** @typedef {number} TypeB */
  /**
   * @type {{
   *   children?: import("svelte").Snippet;
   *   actions?: import("svelte").Snippet<[{ required: boolean; value: string }]>;
   *   string?: string;
   *   number?: number;
   *   fun?: (string) => string;
   *   unionstr?: 'a' | 'b';
   *   unionnumeric?: 0 | 1;
   *   union?: TypeA | TypeB;
   *   required?: string
   * }}
   */
  let {
    children,
    actions,
    string = 'string',
    number = 0,
    fun = (key) => '',
    unionstr = 'a',
    unionnumeric = 1,
    union = null,
    required = '',
    unknown = undefined,
    onchange,
    onclose,
  } = $props();

  /**
   * @type {(string) => string}
   */

  /**
   * @type {'a'|'b'}
   */

  /**
   * @type {0|1}
   */

  /** @type {TypeA|TypeB}*/

  function onClick() {
    /**
     * Event description
     */
    onchange?.('some value');
  }

  let preview = $derived({
    string,
    number,
    fun,
    unionstr,
    unionnumeric,
    union,
    required,
    unknown,
  });
</script>

<pre onclick={onClick}>{JSON.stringify(preview, null, '  ')}</pre>

<!-- 
    User has clicked this element
-->
<div></div>

<div onclick={() => /** Close description */ onclose?.()}></div>

{@render children()}

{@render actions({ required, value: string })}
