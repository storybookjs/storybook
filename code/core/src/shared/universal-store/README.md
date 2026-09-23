# Universal Store

The Universal Store API is used to manage state and events that should be synced across multiple environments, such as the server, the manager or the preview.

It is internal to Storybook. `UniversalStore.create()` throws for store ids that Storybook does not own, listed in [first-party-store-ids.ts](./first-party-store-ids.ts).

For docs, see [UniversalStore's JSDocs](./index.ts). For usage examples and expected behavior, see [the tests](./index.test.ts)
