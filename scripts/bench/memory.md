# Storybook memory benchmark

Run the representative React/Vite workload from the repository root:

```sh
yarn task --task memory --template bench/react-vite-default-ts --start-from auto --no-link
```

The command writes `memory-benchmark.json` inside the generated sandbox. The versioned report retains every sample, the peak aggregate RSS of the Storybook process tree, the final settled RSS, and HMR growth per edit for cold dev startup, ten edits, and a static build.

The first iteration is Linux-only. It samples `/proc` every 100ms, measures the Storybook process and every descendant, excludes Chromium from the server total, and leaves garbage collection natural. Run comparison samples on the same runner class, Node version, heap settings, and idle machine; capture multiple runs before selecting a regression threshold.
