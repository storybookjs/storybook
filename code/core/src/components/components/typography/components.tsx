import type {
  HTMLAttributes,
  DetailedHTMLProps,
  AnchorHTMLAttributes,
  BlockquoteHTMLAttributes,
  ImgHTMLAttributes,
  TableHTMLAttributes,
  LiHTMLAttributes,
  OlHTMLAttributes,
} from 'react';
import React from 'react';
import { nameSpaceClassNames } from './DocumentFormatting';
import { A } from './elements/A';
import { Blockquote } from './elements/Blockquote';
import { Code } from './elements/Code';
import { Div } from './elements/Div';
import { DL } from './elements/DL';
import { H1 } from './elements/H1';
import { H2 } from './elements/H2';
import { H3 } from './elements/H3';
import { H4 } from './elements/H4';
import { H5 } from './elements/H5';
import { H6 } from './elements/H6';
import { HR } from './elements/HR';
import { Img } from './elements/Img';
import { LI } from './elements/LI';
import { OL } from './elements/OL';
import { P } from './elements/P';
import { Pre } from './elements/Pre';
import { Span } from './elements/Span';
import { Table } from './elements/Table';
import { TT } from './elements/TT';
import { UL } from './elements/UL';
import { ResetWrapper } from './ResetWrapper';

export const components = {
  h1: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H1 {...nameSpaceClassNames(props, 'h1')} />
  ),
  h2: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H2 {...nameSpaceClassNames(props, 'h2')} />
  ),
  h3: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H3 {...nameSpaceClassNames(props, 'h3')} />
  ),
  h4: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H4 {...nameSpaceClassNames(props, 'h4')} />
  ),
  h5: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H5 {...nameSpaceClassNames(props, 'h5')} />
  ),
  h6: (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => (
    <H6 {...nameSpaceClassNames(props, 'h6')} />
  ),
  pre: (props: DetailedHTMLProps<HTMLAttributes<HTMLPreElement>, HTMLPreElement>) => (
    <Pre {...nameSpaceClassNames(props, 'pre')} />
  ),
  a: (props: DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>) => (
    <A {...nameSpaceClassNames(props, 'a')} />
  ),
  hr: (props: DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement>) => (
    <HR {...nameSpaceClassNames(props, 'hr')} />
  ),
  dl: (props: DetailedHTMLProps<HTMLAttributes<HTMLDListElement>, HTMLDListElement>) => (
    <DL {...nameSpaceClassNames(props, 'dl')} />
  ),
  blockquote: (props: DetailedHTMLProps<BlockquoteHTMLAttributes<HTMLElement>, HTMLElement>) => (
    <Blockquote {...nameSpaceClassNames(props, 'blockquote')} />
  ),
  table: (props: DetailedHTMLProps<TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>) => (
    <Table {...nameSpaceClassNames(props, 'table')} />
  ),
  img: (props: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>) => (
    <Img {...nameSpaceClassNames(props, 'img')} />
  ),
  div: (props: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
    <Div {...nameSpaceClassNames(props, 'div')} />
  ),
  span: (props: DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>) => (
    <Span {...nameSpaceClassNames(props, 'span')} />
  ),
  li: (props: DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>) => (
    <LI {...nameSpaceClassNames(props, 'li')} />
  ),
  ul: (props: DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>) => (
    <UL {...nameSpaceClassNames(props, 'ul')} />
  ),
  ol: (props: DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>) => (
    <OL {...nameSpaceClassNames(props, 'ol')} />
  ),
  p: (props: DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>) => (
    <P {...nameSpaceClassNames(props, 'p')} />
  ),
  code: (props: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>) => (
    <Code {...nameSpaceClassNames(props, 'code')} />
  ),
  tt: (props: DetailedHTMLProps<HTMLAttributes<HTMLTitleElement>, HTMLTitleElement>) => (
    <TT {...nameSpaceClassNames(props, 'tt')} />
  ),
  resetwrapper: (props: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
    <ResetWrapper {...nameSpaceClassNames(props, 'resetwrapper')} />
  ),
};
