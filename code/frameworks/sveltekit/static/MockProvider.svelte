<script>
  import { onMount } from 'svelte';
  import { action } from 'storybook/actions';
  
  import { setAfterNavigateArgument } from '@storybook/sveltekit/internal/mocks/app/navigation';
  import { setAppStoresNavigating, setAppStoresPage, setAppStoresUpdated } from '@storybook/sveltekit/internal/mocks/app/stores';

  const { svelteKitParameters = {}, children } = $props();

  // Set context during component initialization - this happens before any child components
  setAppStoresPage(svelteKitParameters?.stores?.page);
  setAppStoresNavigating(svelteKitParameters?.stores?.navigating);
  setAppStoresUpdated(svelteKitParameters?.stores?.updated);
  setAfterNavigateArgument(svelteKitParameters?.navigation?.afterNavigate);

  const normalizeHrefConfig = (hrefConfig) => {
    if (typeof hrefConfig === 'function') {
      return { callback: hrefConfig, asRegex: false };
    }
    return hrefConfig;
  };

  onMount(() => {
    const globalClickListener = (e) => {
      // we add a global click event listener and we check if there's a link in the composedPath
      const path = e.composedPath();
      const element = path.findLast((el) => el instanceof HTMLElement && el.tagName === 'A');
      if (element && element instanceof HTMLAnchorElement) {
        // if the element is an a-tag we get the href of the element
        // and compare it to the hrefs-parameter set by the user
        const to = element.getAttribute('href');
        if (!to) {
          return;
        }
        e.preventDefault();
        const defaultActionCallback = () => action('navigate')(to, e);
        if (!svelteKitParameters.hrefs) {
          defaultActionCallback();
          return;
        }

        let callDefaultCallback = true;
        // we loop over every href set by the user and check if the href matches
        // if it does we call the callback provided by the user and disable the default callback
        Object.entries(svelteKitParameters.hrefs).forEach(([href, hrefConfig]) => {
          const { callback, asRegex } = normalizeHrefConfig(hrefConfig);
          const isMatch = asRegex ? new RegExp(href).test(to) : to === href;
          if (isMatch) {
            callDefaultCallback = false;
            callback?.(to, e);
          }
        });
        if (callDefaultCallback) {
          defaultActionCallback();
        }
      }
    };

    /**
     * Function that create and add listeners for the event that are emitted by the mocked
     * functions. The event name is based on the function name
     *
     * Eg. storybook:goto, storybook:invalidateAll
     *
     * @param baseModule The base module where the function lives (navigation|forms)
     * @param functions The list of functions in that module that emit events
     * @param {boolean} [defaultToAction] The list of functions in that module that emit events
     * @returns A function to remove all the listener added
     */
    function createListeners(baseModule, functions, defaultToAction) {
      // the array of every added listener, we can use this in the return function
      // to clean them
      const toRemove = [];
      functions.forEach((func) => {
        // we loop over every function and check if the user actually passed
        // a function in sveltekit_experimental[baseModule][func] eg. sveltekit_experimental.navigation.goto
        const hasFunction =
          svelteKitParameters[baseModule]?.[func] &&
          svelteKitParameters[baseModule][func] instanceof Function;
        // if we default to an action we still add the listener (this will be the case for goto, invalidate, invalidateAll)
        if (hasFunction || defaultToAction) {
          // we create the listener that will just get the detail array from the custom element
          // and call the user provided function spreading this args in...this will basically call
          // the function that the user provide with the same arguments the function is invoked to

          // eg. if it calls goto("/my-route") inside the component the function sveltekit_experimental.navigation.goto
          // it provided to storybook will be called with "/my-route"
          const listener = ({ detail = [] }) => {
            const args = Array.isArray(detail) ? detail : [];
            // if it has a function in the parameters we call that function
            // otherwise we invoke the action
            const fnToCall = hasFunction
              ? svelteKitParameters[baseModule][func]
              : action(func);
            fnToCall(...args);
          };
          const eventType = `storybook:${func}`;
          toRemove.push({ eventType, listener });
          // add the listener to window
          window.addEventListener(eventType, listener);
        }
      });
      return () => {
        // loop over every listener added and remove them
        toRemove.forEach(({ eventType, listener }) => {
          window.removeEventListener(eventType, listener);
        });
      };
    }

    const removeNavigationListeners = createListeners(
      'navigation',
      ['goto', 'invalidate', 'invalidateAll', 'pushState', 'replaceState'],
      true
    );
    const removeFormsListeners = createListeners('forms', ['enhance']);
    window.addEventListener('click', globalClickListener);

    return () => {
      window.removeEventListener('click', globalClickListener);
      removeNavigationListeners();
      removeFormsListeners();
    };
  });
</script>

{@render children()}
