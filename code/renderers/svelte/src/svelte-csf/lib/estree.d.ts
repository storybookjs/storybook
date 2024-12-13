// Copied & modified from: https://github.com/sveltejs/language-tools/blob/master/packages%2Fsvelte2tsx%2Fsrc%2Festree.d.ts
import 'estree';

// estree does not have start/end in their public Node interface,
// but the AST returned by svelte/compiler does.
// We add the those properties here and add Node as an interface
// to estree.

declare module 'estree' {
  export interface BaseNode {
    start?: number;
    end?: number;
    [propName: string]: any;
  }
}
