---
"vite-plugin-storybook-nextjs": patch
---

Fix missing Next.js 16 internal exports (`ServerInsertedHTMLContext`, `RedirectStatusCode`) in Vite dev mode by adding `next/navigation` and `next/dist/client/components/redirect-error` to `optimizeDeps.include` for Next.js 16+. See [storybookjs/storybook#34688](https://github.com/storybookjs/storybook/issues/34688).
