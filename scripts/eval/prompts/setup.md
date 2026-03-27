# Complete Storybook Setup

Storybook has just been initialized in this project with `npx storybook@latest init --yes`.
The basic scaffolding is in place but the setup needs to be completed so that stories render correctly.

## Steps

1. **Analyze the project**: Read `package.json` and source code to understand the tech stack — CSS framework, state management, routing, theming, and any global providers.

2. **Configure `.storybook/preview.ts`**: Make stories render like the real app by adding:
   - Global CSS imports (Tailwind CSS, global stylesheets, CSS resets, font imports)
   - Provider decorators wrapping every story (Redux store, React Router, Theme providers, i18n, etc.)
   - Appropriate `parameters` (viewport, backgrounds, etc.)

3. **Configure `.storybook/main.ts`**: Adjust if needed:
   - `staticDirs` for public assets (images, fonts)
   - Framework-specific overrides (e.g., `viteFinal` or `webpackFinal`)
   - Autodocs if the project uses JSDoc or TSDoc

4. **Verify the setup**: Run `npx storybook build` to check for errors. If it fails:
   - Read the error output carefully
   - Fix the root cause (missing import, wrong config, etc.)
   - Run the build again
   - Repeat until the build succeeds

## Guidelines

- Look at the app's entry point (`main.tsx`, `index.tsx`, `App.tsx`) to find providers and global setup
- Check for CSS framework config files (`tailwind.config.*`, `postcss.config.*`, etc.)
- Keep changes minimal — only modify what is needed to make stories render
- Do NOT create new stories or components
- Do NOT remove existing stories
- Prefer importing existing app utilities over re-implementing them
