# CSF corpus

Frozen story files and the outputs the Babel-based `CsfFile` produced for them, recorded once from
the last `next` commit that still indexed with Babel. `corpus.test.ts` runs the OXC implementation
over the same inputs and compares with `toEqual`, so `vitest -u` cannot re-baseline the outputs.

Rerun on an OXC upgrade. To extend the corpus, add inputs and record again from a Babel checkout:

```sh
node code/core/src/csf-tools/__corpus__/record.mjs <babel-checkout>/code
```
