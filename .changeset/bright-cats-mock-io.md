---
'@storybook/nextjs-vite': patch
'vite-plugin-storybook-nextjs': patch
---

Mock the `next/cache` `io()`, `navigation()`, and `prefetch()` exports so stories using Next.js 16 Cache Components load in Storybook with the Next.js Vite framework.
