declare namespace svelteNative.JSX {

    // Every namespace eligible for use needs to implement the following two functions
    function mapElementTag(
        tag: string
    ): any;

    function createElement<Elements extends IntrinsicElements, Key extends keyof Elements>(
        element: Key | undefined | null, attrs: Elements[Key]
    ): any;
    function createElement<Elements extends IntrinsicElements, Key extends keyof Elements, T>(
        element: Key | undefined | null, attrEnhancers: T, attrs: Elements[Key] & T
    ): any;


    /* svelte specific */
    interface ElementClass {
        $$prop_def: any;
    }

    interface ElementAttributesProperty {
        $$prop_def: any; // specify the property name to use
    }

    // Add empty IntrinsicAttributes to prevent fallback to the one in the JSX namespace
    interface IntrinsicAttributes {
    }

    interface IntrinsicElements {
        [name: string]: { [name: string]: any };
    }
}