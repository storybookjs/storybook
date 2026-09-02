// Captured build product: the runtime `ɵcmp.inputs`/`ɵcmp.outputs` maps this component
// gets under AOT, read off the loaded output of `ngc` (@angular/compiler-cli 21.2.17).
// Bare JIT leaves both maps empty for signal members, so the recorder attaches this
// before generating snippets (see the README capture procedure).
export const aotCmp: {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
} = {
  inputs: {
    label: ['label', 1, null],
    count: ['count', 1, null],
    increment: ['step', 1, null],
    disabled: ['disabled', 1, null],
  },
  outputs: { toggled: 'toggled' },
};
