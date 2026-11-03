# Chromatic Projects

Pass the project ID as `projectId` to the Chromatic tools. Sandbox projects are listed by template key. CI job names use the template's display name instead, and `code/lib/cli-storybook/src/sandbox-templates.ts` maps each display name to its key.

| Project                                  | Project ID                         |
| ---------------------------------------- | ---------------------------------- |
| internal Storybook UI (`code/`)          | `Project:635781f3500dd2c49e189caf` |
| `react-vite/default-ts`                  | `Project:630511d655df72125520f051` |
| `react-vite/default-js`                  | `Project:6305104a03ce824473a88c65` |
| `react-vite/prerelease-ts`               | `Project:6637a367fa5b4eaa26d92d25` |
| `react-webpack/18-ts`                    | `Project:633c394125f29c2cbb5a4cac` |
| `react-webpack/prerelease-ts`            | `Project:6637a3aad047d2bb1b3cbfe9` |
| `react-native-web-vite/expo-ts`          | `Project:6739a507de968e78c90c81af` |
| `nextjs/default-ts`                      | `Project:634ff0d0ec053b270775979d` |
| `nextjs/15-ts`                           | `Project:68fa3e766deb52421c1acf27` |
| `nextjs/prerelease`                      | `Project:6527cbbdfc5de6c10b0bbe2b` |
| `nextjs-vite/default-ts`                 | `Project:66b1e47012f95c6f90c8882e` |
| `nextjs-vite/15-ts`                      | `Project:68fa3c0353a6ab43d601462f` |
| `tanstack-react-router/default-ts`       | `Project:69f08674491608f953c605b2` |
| `tanstack-react-start/default-ts`        | `Project:69f0872a77e679e347550cfe` |
| `angular-cli/default-ts`                 | `Project:6322ce6af69825592bbb28fc` |
| `angular-vite/default-ts`                | `Project:6a021028c2f37c1d2f640723` |
| `angular-vite/21-ts`                     | `Project:6a39460ac63cf417c1a079ff` |
| `vue3-vite/default-ts`                   | `Project:630513346a8e284ae244d415` |
| `vue3-vite/prerelease-ts`                | `Project:6acf97c724e2b86a56912992` |
| `svelte-vite/default-ts`                 | `Project:630873996e4e3557791c069c` |
| `svelte-kit/skeleton-ts`                 | `Project:634ff6954afef8aae1c1b29b` |
| `lit-vite/default-ts`                    | `Project:638db5bf49adfdfe8cf545e0` |
| `preact-vite/default-ts`                 | `Project:63b588a512565bfaace15e7c` |
| `html-vite/default-ts`                   | `Project:63dd39a158cf6fc05199b4bb` |
| `internal/react18-webpack-babel`         | `Project:659810cb7e778e400627527a` |
| `bench/react-vite-default-ts-test-build` | `Project:6544b941802d9ff884a3f74d` |
| `bench/react-webpack-18-ts-test-build`   | `Project:6544b98f47ff41fd955b43cb` |

When you add or remove a template that runs the `chromatic` task, update this table in the same PR.
