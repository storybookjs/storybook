// Captured build product: the runtime `ɵcmp.inputs`/`ɵcmp.outputs` maps this component
// gets under AOT, read off the loaded output of `ngc` (@angular/compiler-cli 21.2.17).
// Bare JIT leaves both maps empty for signal members, so the recorder attaches this
// before generating snippets (see the README capture procedure). Angular itself resolves
// `aliased` as a normal working input here - only compodoc's docs extraction is fooled
// by the import alias.
export const aotCmp: {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
} = {
  inputs: {
    aliased: ['aliased', 1, null],
  },
  outputs: {},
};
