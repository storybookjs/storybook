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
            // 👇 Use the environment variable you passed
            storybookUrl: process.env.SB_URL,
          }),
        ],
      },
    ],
  },
});
```
