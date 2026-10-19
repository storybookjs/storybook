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
