```ts filename="vitest.config.ts" renderer="common" tabTitle="Vitest 4"
export default defineConfig({
  // ...
  test: {
    // ...
    projects: [
      {
        plugins: [
          storybookTest({
            // ...
            tags: {
              include: ['test'],
              exclude: ['experimental'],
            },
          }),
        ],
        // ...
      },
    ],
  },
});
```

```ts filename="vitest.workspace.ts" renderer="common" tabTitle="Vitest 3"
export default defineWorkspace([
  // ...
  {
    // ...
    {
      plugins: [
        storybookTest({
          // ...
          tags: {
            include: ['test'],
            exclude: ['experimental'],
          },
        }),
      ],
    },
  },
]);
```
