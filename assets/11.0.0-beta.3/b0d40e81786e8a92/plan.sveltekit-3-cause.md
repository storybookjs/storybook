# plan.sveltekit-3: `npx sv migrate sveltekit-3` refuses to run

- File: node_modules of sv@1.5.0 (npx cache), dist/bin.mjs, the `sveltekit-3` migration `setup` (about line 5070), and `app-state` setup (about line 2777).
- Why it fails: the check `if (!pkg.devDependencies?.["@sveltejs/kit"]) throw ...` only reads devDependencies. This project lists `@sveltejs/kit` in `dependencies` (package.json line 11), so sv stops with "is not a devDependency in package.json".
- Fix tried: a copy of the check that also accepts `pkg.dependencies`, applied to the cached sv copy only (backup kept as bin.mjs.orig). The project's package.json is not edited.
