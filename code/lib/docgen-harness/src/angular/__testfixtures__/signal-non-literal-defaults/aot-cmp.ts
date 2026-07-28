// Captured build product: the runtime `ɵcmp.inputs`/`ɵcmp.outputs` maps this component
// gets under AOT, read off the loaded output of `ngc` (@angular/compiler-cli 21.2.17).
// Bare JIT leaves both maps empty for signal members, so the recorder attaches this
// before generating snippets (see the README capture procedure). Angular resolves all
// four inputs here - only compodoc's non-literal-default parsing loses type/default info.
export const aotCmp: {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
} = {
  inputs: {
    list: ['list', 1, null],
    computed: ['computed', 1, null],
    config: ['config', 1, null],
    requiredValue: ['requiredValue', 1, null],
  },
  outputs: {},
};
