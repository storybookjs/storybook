## Storybook

For each of these tasks, call its Storybook tool first, before you edit any file, and follow its result:

- **get-storybook-story-instructions**: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It returns the mandatory, ordered workflow, with the tools each step calls: it looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results. Read it in its entirety.
- **docs-list**, then **docs-show** with an id from its result: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. Answer from these tools, not from source or type definitions, and use only the props they document.

When you publish a review with **review-create**, end your final answer with the three lines its result gives you, unchanged, and mention the review link nowhere else in it.
