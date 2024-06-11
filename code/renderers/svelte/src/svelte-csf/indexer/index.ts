import fs from 'node:fs/promises';

import { combineTags } from '@storybook/csf';
import type { IndexInput, Indexer } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import { getSvelteAST } from '#parser/ast';

import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractDefineMetaPropertiesNodes } from '#parser/extract/svelte/define-meta';
import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';

import {
  getPropertyArrayOfStringsValue,
  getPropertyStringValue,
} from '#parser/analyse/define-meta/properties';
import { getArrayOfStringsValueFromAttribute } from '#parser/analyse/story/attributes';
import { getStoryIdentifiers } from '#parser/analyse/story/attributes/identifiers';

export const indexer: Indexer = {
  test: /\.svelte$/,
  createIndex: async (filename, { makeTitle }) => {
    let [code, { loadSvelteConfig }] = await Promise.all([
      fs.readFile(filename, { encoding: 'utf8' }),
      import('@sveltejs/vite-plugin-svelte'),
    ]);

    const svelteConfig = await loadSvelteConfig();
    if (svelteConfig?.preprocess) {
      code = (
        await preprocess(code, svelteConfig.preprocess, {
          filename: filename,
        })
      ).code;
    }

    const svelteAST = getSvelteAST({ code, filename });
    const svelteASTNodes = await extractSvelteASTNodes({
      ast: svelteAST,
      filename,
    });
    const metaPropertiesNodes = extractDefineMetaPropertiesNodes({
      nodes: svelteASTNodes,
      filename,
      properties: ['id', 'title', 'tags'],
    });
    const metaTitle = metaPropertiesNodes.title
      ? makeTitle(
          getPropertyStringValue({
            node: metaPropertiesNodes.title,
            filename,
          })
        )
      : undefined;
    const metaTags = metaPropertiesNodes.tags
      ? getPropertyArrayOfStringsValue({
          node: metaPropertiesNodes.tags,
          filename,
        })
      : [];
    // TODO: Verify if we can remove it
    const metaId = metaPropertiesNodes.id
      ? getPropertyStringValue({ node: metaPropertiesNodes.id, filename })
      : undefined;

    return svelteASTNodes.storyComponents.map(({ component }) => {
      const attributeNode = extractStoryAttributesNodes({
        component,
        filename,
        attributes: ['exportName', 'name', 'tags'],
      });
      const { exportName, name } = getStoryIdentifiers({
        component,
        nameNode: attributeNode.name,
        exportNameNode: attributeNode.exportName,
        filename,
      });
      const tags = getArrayOfStringsValueFromAttribute({
        node: attributeNode.tags,
        filename,
        component,
      });

      return {
        type: 'story',
        importPath: filename,
        exportName,
        name,
        title: metaTitle,
        tags: combineTags(...metaTags, ...tags),
      } satisfies IndexInput;
    });
  },
};
