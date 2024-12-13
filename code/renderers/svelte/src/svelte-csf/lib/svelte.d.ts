declare module 'svelte/compiler' {
  import { Node as ESTreeNode } from 'estree';

  declare namespace AST {
    export interface BaseNode {
      // NOTE: We are overriding the type here, because we don't need those
      start?: number;
      end?: number;
      [propName: string]: any;
    }

    // FIXME: Those types are not exported from `svelte/compiler` - need to create an issue
    // Temporarily manually exporting them

    export type Block =
      | AST.EachBlock
      | AST.IfBlock
      | AST.AwaitBlock
      | AST.KeyBlock
      | AST.SnippetBlock;

    export type Directive =
      | AST.AnimateDirective
      | AST.BindDirective
      | AST.ClassDirective
      | AST.LetDirective
      | AST.OnDirective
      | AST.StyleDirective
      | AST.TransitionDirective
      | AST.UseDirective;

    export type ElementLike =
      | AST.Component
      | AST.TitleElement
      | AST.SlotElement
      | AST.RegularElement
      | AST.SvelteBody
      | AST.SvelteComponent
      | AST.SvelteDocument
      | AST.SvelteElement
      | AST.SvelteFragment
      | AST.SvelteHead
      | AST.SvelteOptionsRaw
      | AST.SvelteSelf
      | AST.SvelteWindow;

    type Tag = AST.ExpressionTag | AST.HtmlTag | AST.ConstTag | AST.DebugTag | AST.RenderTag;

    export type TemplateNode =
      | AST.Root
      | AST.Text
      | Tag
      | ElementLike
      | AST.Attribute
      | AST.SpreadAttribute
      | Directive
      | AST.Comment
      | Block;

    export type SvelteNode = ESTreeNode | TemplateNode | AST.Fragment;
  }
}
