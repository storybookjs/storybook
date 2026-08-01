import type {
  AnchorHTMLAttributes,
  BlockquoteHTMLAttributes,
  DetailedHTMLProps,
  HTMLAttributes,
  ImgHTMLAttributes,
  LiHTMLAttributes,
  OlHTMLAttributes,
  TableHTMLAttributes,
} from 'react';
import React from 'react';

import { nameSpaceClassNames } from './DocumentFormatting.tsx';
import { ResetWrapper } from './ResetWrapper.tsx';
import { A } from './elements/A.tsx';
import { Blockquote } from './elements/Blockquote.tsx';
import { Code } from './elements/Code.tsx';
import { DL } from './elements/DL.tsx';
import { Div } from './elements/Div.tsx';
import { H1 } from './elements/H1.tsx';
import { H2 } from './elements/H2.tsx';
import { H3 } from './elements/H3.tsx';
import { H4 } from './elements/H4.tsx';
import { H5 } from './elements/H5.tsx';
import { H6 } from './elements/H6.tsx';
import { HR } from './elements/HR.tsx';
import { Img } from './elements/Img.tsx';
import { LI } from './elements/LI.tsx';
import { OL } from './elements/OL.tsx';
import { P } from './elements/P.tsx';
import { Pre } from './elements/Pre.tsx';
import { Span } from './elements/Span.tsx';
import { TT } from './elements/TT.tsx';
import { Table } from './elements/Table.tsx';
import { UL } from './elements/UL.tsx';

export const components = {
  h1: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H1 {...nameSpaceClassNames(props, 'h1')} />,
  h2: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H2 {...nameSpaceClassNames(props, 'h2')} />,
  h3: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H3 {...nameSpaceClassNames(props, 'h3')} />,
  h4: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H4 {...nameSpaceClassNames(props, 'h4')} />,
  h5: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H5 {...nameSpaceClassNames(props, 'h5')} />,
  h6: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
  ): React.JSX.Element => <H6 {...nameSpaceClassNames(props, 'h6')} />,
  pre: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLPreElement>, HTMLPreElement>
  ): React.JSX.Element => <Pre {...nameSpaceClassNames(props, 'pre')} />,
  a: (
    props: DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>
  ): React.JSX.Element => <A {...nameSpaceClassNames(props, 'a')} />,
  hr: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement>
  ): React.JSX.Element => <HR {...nameSpaceClassNames(props, 'hr')} />,
  dl: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLDListElement>, HTMLDListElement>
  ): React.JSX.Element => <DL {...nameSpaceClassNames(props, 'dl')} />,
  blockquote: (
    props: DetailedHTMLProps<BlockquoteHTMLAttributes<HTMLElement>, HTMLElement>
  ): React.JSX.Element => <Blockquote {...nameSpaceClassNames(props, 'blockquote')} />,
  table: (
    props: DetailedHTMLProps<TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>
  ): React.JSX.Element => <Table {...nameSpaceClassNames(props, 'table')} />,
  img: (
    props: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>
  ): React.JSX.Element => <Img {...nameSpaceClassNames(props, 'img')} />,
  div: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>
  ): React.JSX.Element => <Div {...nameSpaceClassNames(props, 'div')} />,
  span: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>
  ): React.JSX.Element => <Span {...nameSpaceClassNames(props, 'span')} />,
  li: (
    props: DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>
  ): React.JSX.Element => <LI {...nameSpaceClassNames(props, 'li')} />,
  ul: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>
  ): React.JSX.Element => <UL {...nameSpaceClassNames(props, 'ul')} />,
  ol: (
    props: DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>
  ): React.JSX.Element => <OL {...nameSpaceClassNames(props, 'ol')} />,
  p: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
  ): React.JSX.Element => <P {...nameSpaceClassNames(props, 'p')} />,
  code: (props: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>): React.JSX.Element => (
    <Code {...nameSpaceClassNames(props, 'code')} />
  ),
  tt: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLTitleElement>, HTMLTitleElement>
  ): React.JSX.Element => <TT {...nameSpaceClassNames(props, 'tt')} />,
  resetwrapper: (
    props: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>
  ): React.JSX.Element => <ResetWrapper {...nameSpaceClassNames(props, 'resetwrapper')} />,
};
