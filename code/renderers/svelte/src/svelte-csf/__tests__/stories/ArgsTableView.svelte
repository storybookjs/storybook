<script>
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let string = 'string';
    export let number = 0;
    /**
     * @type {(string) => string}
     */
    export let fun = (key) => '';
    /**
     * @type {'a'|'b'}
     */
    export let unionstr = 'a';

     /**
     * @type {0|1}
     */
     export let unionnumeric = 1;

    /** @typedef {object} TypeA */
    /** @typedef {number} TypeB */
    /** @type {TypeA|TypeB}*/
    export let union = null;

    /**
     * @required
     */
    export let required = '';

    export let unknown = undefined;

    function onClick() {
        /**
         * Event description 
         */
        dispatch('change', "some value");
    }

    $: preview = {
        string,
        number,
        fun,
        unionstr,
        unionnumeric,
        union,
        required,
        unknown,
    }
    
</script>

<pre on:click={onClick}>{JSON.stringify(preview, null, '  ')}</pre>

<!-- 
    User has clicked this element
-->
<div on:click/>

<div on:click={() => /** Close description */ dispatch('close')}/>

<!-- Default Slot -->
<slot/>

<!-- Slot for actions -->
<slot name="actions" {required} value={string}/>