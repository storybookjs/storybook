import { expect, it } from 'vitest';

import { transform } from '@babel/core';

import TransformFontImports from '.';

const example = `
import { Inter, Lora as FontLora, Roboto } from 'next/font/google'
import localFont from 'next/font/local'

const myFont = localFont({ src: './my-font.woff2' })

const roboto = Roboto({
  weight: '400',
})

const lora = FontLora({
  weight: '400',
})

const inter = Inter({
  subsets: ['latin'],
});

const randomObj = {}
`;

const exampleLegacy = `
import { Inter, Lora as FontLora, Roboto } from '@next/font/google'
import localFont from '@next/font/local'

const myFont = localFont({ src: './my-font.woff2' })

const roboto = Roboto({
  weight: '400',
})

const lora = FontLora({
  weight: '400',
})

const inter = Inter({
  subsets: ['latin'],
});

const randomObj = {}
`;

it('should transform next/font AST properly', () => {
  const { code } = transform(example, { plugins: [TransformFontImports] })!;
  expect(code).toMatchInlineSnapshot(`
    "import inter from "storybook-nextjs-font-loader?{\\"source\\":\\"next/font/google\\",\\"props\\":{\\"subsets\\":[\\"latin\\"]},\\"fontFamily\\":\\"Inter\\",\\"filename\\":\\"\\"}!next/font/google";
    import lora from "storybook-nextjs-font-loader?{\\"source\\":\\"next/font/google\\",\\"props\\":{\\"weight\\":\\"400\\"},\\"fontFamily\\":\\"Lora\\",\\"filename\\":\\"\\"}!next/font/google";
    import roboto from "storybook-nextjs-font-loader?{\\"source\\":\\"next/font/google\\",\\"props\\":{\\"weight\\":\\"400\\"},\\"fontFamily\\":\\"Roboto\\",\\"filename\\":\\"\\"}!next/font/google";
    import myFont from "storybook-nextjs-font-loader?{\\"source\\":\\"next/font/local\\",\\"props\\":{\\"src\\":\\"./my-font.woff2\\"},\\"fontFamily\\":\\"localFont\\",\\"filename\\":\\"\\"}!next/font/local";
    const randomObj = {};"
  `);
});

it('should transform @next/font AST properly', () => {
  const { code } = transform(exampleLegacy, { plugins: [TransformFontImports] })!;
  expect(code).toMatchInlineSnapshot(`
    "import inter from "storybook-nextjs-font-loader?{\\"source\\":\\"@next/font/google\\",\\"props\\":{\\"subsets\\":[\\"latin\\"]},\\"fontFamily\\":\\"Inter\\",\\"filename\\":\\"\\"}!@next/font/google";
    import lora from "storybook-nextjs-font-loader?{\\"source\\":\\"@next/font/google\\",\\"props\\":{\\"weight\\":\\"400\\"},\\"fontFamily\\":\\"Lora\\",\\"filename\\":\\"\\"}!@next/font/google";
    import roboto from "storybook-nextjs-font-loader?{\\"source\\":\\"@next/font/google\\",\\"props\\":{\\"weight\\":\\"400\\"},\\"fontFamily\\":\\"Roboto\\",\\"filename\\":\\"\\"}!@next/font/google";
    import myFont from "storybook-nextjs-font-loader?{\\"source\\":\\"@next/font/local\\",\\"props\\":{\\"src\\":\\"./my-font.woff2\\"},\\"fontFamily\\":\\"localFont\\",\\"filename\\":\\"\\"}!@next/font/local";
    const randomObj = {};"
  `);
});
