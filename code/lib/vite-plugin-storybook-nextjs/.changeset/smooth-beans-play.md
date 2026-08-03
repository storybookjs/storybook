---
"vite-plugin-storybook-nextjs": patch
---

Fix Next.js navigation and router mocks losing exports in dev mode

A few members of `next/navigation` and `next/router` were only forwarded at runtime, so importing them by name failed in dev with "does not provide an export named". Production builds were never affected. Those members are now declared explicitly.
