---
"vite-plugin-storybook-nextjs": patch
---

Handle ambiguous default import from CJS module in next/image mocks. Defensively unwrap `__esModule` objects to extract the real default export and `getImageProps`, following Rolldown's recommendation for CJS interop.
