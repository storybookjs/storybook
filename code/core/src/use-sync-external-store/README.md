# use-sync-external-store shim

This package exists because React provide `use-sync-external-store` for React 16/17 compat, but they only provide it as a CJS package. See https://github.com/facebook/react/issues/11503.

The react-aria / react-stately ecosystem of packages call `use-sync-external-store`, and because we use them for our accessible UI components, we end up with a CJS-only dependency.

We alias the dependency to this local package which simply loads the originally shimmed code back from React. As we only use React 18+, we know the dependency will always be available within React.

And so, we shim a shim to have it load the code it's supposed to be shimming.
