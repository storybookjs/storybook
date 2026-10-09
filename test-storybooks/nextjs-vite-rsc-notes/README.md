# Notes demo with `@storybook/nextjs-vite-rsc`

A Next.js App Router notes app, with a story for every route and for its components: Server Components that read the database and the session, Server Actions, forms, redirects, `next/link`, `next/font` and third-party Client Components. Its stories render the app as it runs, through `@storybook/nextjs-vite-rsc`, and CI builds the Storybook and runs it on Chromatic.

It is `playground/nextjs-notes-demo` of [vitest-plugin-rsc](https://github.com/storybookjs/vitest-plugin-rsc), with what Storybook needs: the app, its stories and `.storybook`, without its Vitest tests. The database is an in-memory PGlite per story, which `.storybook/preview.ts` makes.

The Storybook packages are linked from `code/` with the `file:` protocol. Compile them first, and install again after you compile them again:

```sh
yarn nx compile nextjs-vite-rsc -c production # from the root of the repository
cd test-storybooks/nextjs-vite-rsc-notes
yarn install
yarn storybook # or: yarn build-storybook
```

The app is derived from a notes app by Vercel, under the MIT license in `LICENSE`.
