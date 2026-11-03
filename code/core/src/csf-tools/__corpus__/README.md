# CSF corpus

Frozen story files and two sets of golden outputs, which `corpus.test.ts` compares with `toEqual`,
so `vitest -u` cannot re-baseline them.

- `golden.json` holds what the Babel-based `CsfFile` indexed: index inputs, meta, stories and
  bindings, recorded once from the last `next` commit that still indexed with Babel.
- `transforms.json` holds the `enrichCsf` and `vitestTransform` outputs, formatted with Prettier so
  layout does not count, and each story's `parameters.docs.source.originalSource`. They were
  recorded from the OXC implementation. A Babel build produced the same outputs apart from
  `originalSource`, which Babel reprinted, comment placement, and generated imports, which Babel
  put above a file's header comment.

Rerun the test on an OXC upgrade. When an upgrade changes a transform on purpose, compile `core` and
record `transforms.json` again, then review the diff:

```sh
yarn nx compile core
node code/core/src/csf-tools/__corpus__/record.mjs transforms
```

To extend the corpus, add inputs, record `golden.json` from a Babel checkout and `transforms.json`
from this one:

```sh
node code/core/src/csf-tools/__corpus__/record.mjs index <babel-checkout>/code
node code/core/src/csf-tools/__corpus__/record.mjs transforms
```
