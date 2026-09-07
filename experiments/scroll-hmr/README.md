# Scroll-loss-on-HMR experiments (#22057 / PR #35205)

70 instrumented Playwright trials against a `react-vite/default-ts` sandbox linked to this
branch's build, isolating each scroll-loss mechanism behind inert `globalThis.__SB_EXP__`
levers (see the commit adding them) toggled per page load via a `?__exp=` URL flag.

Full report: https://claude.ai/code/artifact/4c83f8cc-6095-4c0b-9925-9d2e47d0c906

## Results

| Config | guard | noSpinner | keepDom | keepRoot | fast | slow | loss fingerprint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline (PR as-is) | x | | | | 0/5 | 0/5 | unmount collapse |
| guard reverted | | | | | 0/5 | 0/5 | unmount collapse (identical to baseline) |
| A: spinner off | x | x | | | 0/5 | 0/5 | unmount collapse |
| B1: teardown guard | x | | x | | 0/5 | 0/5 | renderToCanvas 2nd unmount / spinner |
| B2: single-commit swap | x | | x | x | 0/5 | 0/5 | spinner (timer never defused) |
| **all three fixes** | x | x | x | x | **5/5** | **5/5** | — |
| all fixes, guard reverted | | x | x | x | 0/5 | 0/5 | explicit scrollTop=0 at full doc height |

Conclusions:

1. The PR's `scrollReset` guard is **necessary but not sufficient** — alone it changes
   nothing (no code writes scrollTop on the failing path; the browser clamps it when a
   layout pass runs over a collapsed document), but with the collapses fixed it is exactly
   what decides 10/10 vs 0/10.
2. The teardown unmount (`StoryRender.teardown` **and** `renderToCanvas`'s `forceRemount`
   unmount) and the 100 ms preparing spinner are each individually fatal.
3. Root reuse gives a clean one-commit subtree swap (scroll survives the swap itself), but
   the preparing timer's only defusal is `ErrorBoundary.componentDidMount -> showMain()`,
   which never re-fires under root reuse — a real fix must defuse the timer explicitly.

Caveat: the probe's scroll reads force layout inside the unmount gap, making the fast-path
timing lottery near-deterministic in-harness; this biases all configs identically.

## Validation of the real fix

After replacing the levers with the production change (keepRenderedDom teardown option +
key-based remount in the react renderer + spinner gating), the same harness with **no**
`__exp` flags measures **10/10 kept** (fast 5/5, slow 5/5), where the pre-fix build
measured 0/10. Story-to-story navigation still resets scroll and shows the preparing
spinner, and FORCE_REMOUNT still fully unmounts (fresh component instances).

## Reproduce

```bash
# sandbox linked to this branch's build (SB_LOCAL_YARN_RELEASE works around blocked
# repo.yarnpkg.com egress; omit it on a normal network)
SB_LOCAL_YARN_RELEASE=$PWD/.yarn/releases/yarn-4.10.3.cjs \
  yarn task sandbox --template react-vite/default-ts --start-from auto

cd ../storybook-sandboxes/react-vite-default-ts
cp <repo>/experiments/scroll-hmr/probe-preview-head.html .storybook/preview-head.html
cp <repo>/experiments/scroll-hmr/driver.mjs .
yarn storybook > sb.log 2>&1 &        # wait for :6006
TRIALS=5 node driver.mjs              # writes per-trial traces + summary.json
```

`analyze.py` classifies each trial's loss fingerprint from its trace. `results/` holds the
summary, the aggregate analysis, and one representative trace per fingerprint.
