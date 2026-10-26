---
'@storybook/nextjs-vite': patch
'vite-plugin-storybook-nextjs': patch
---

Mock the `next/cache` `io()` export so Client Components using Cache Components render in Storybook with the Next.js Vite framework.
