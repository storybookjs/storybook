export interface ActionsParameters {
  /**
   * Actions configuration
   *
   * @see https://storybook.js.org/docs/essentials/actions#parameters
   */
  actions?: {
    /**
     * Create actions for each arg that matches the regex. (**NOT recommended, see below**)
     *
     * This is quite useful when your component has dozens (or hundreds) of methods and you do not
     * want to manually apply the fn utility for each of those methods. However, this is not the
     * recommended way of writing actions. That's because automatically inferred args are not
     * available as spies in your play function. If you use argTypesRegex and your stories have play
     * functions, you will need to also define args with the fn utility to test them in your play
     * function.
     *
     * @example `argTypesRegex: '^on.*'`
     */
    argTypesRegex?: string;

    /**
     * Removes the addon panel and turns off the feature's behavior. If you wish to turn off this
     * feature for the entire Storybook, you can set the option in your `main.js|ts` configuration
     * file.
     *
     * @see https://storybook.js.org/docs/essentials/actions#disable
     */
    disable?: boolean;

    /**
     * Binds a standard HTML event handler to the outermost HTML element rendered by your component
     * and triggers an action when the event is called for a given selector. The format is
     * `<eventname> <selector>`. The selector is optional; it defaults to all elements.
     *
     * **To enable this feature, you must use the `withActions` decorator.**
     *
     * @example `handles: ['mouseover', 'click .btn']`
     */
    handles?: string[];
  };
}

export interface ActionsTypes {
  parameters: ActionsParameters;
}
