import fs from 'node:fs/promises';

import { combineTags } from '@storybook/csf';
import type { IndexInput, Indexer } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import { getSvelteAST } from '#parser/ast';

import { extractSvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractDefineMetaPropertiesNodes } from '#parser/extract/svelte/define-meta-properties';
import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';

import {
  getMetaIdValue,
  getMetaTagsValue,
  getMetaTitleValue,
} from '#parser/analyse/define-meta/properties';
import { getTagsFromStoryAttribute } from '#parser/analyse/story/svelte/attributes/tags';
import { getStoryIdentifiers } from '#parser/analyse/story/svelte/attributes/identifiers';

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
    const nodes = await extractSvelteASTNodes({ ast: svelteAST, filename });
    const metaPropertiesNodes = extractDefineMetaPropertiesNodes({
      nodes,
      filename,
      properties: ['id', 'title', 'tags'],
    });
    const storiesAttributesNodes = nodes.storyComponents.map(({ component }) =>
      extractStoryAttributesNodes({
        component,
        filename,
        attributes: ['exportName', 'name', 'tags'],
      })
    );

    const metaTitle = metaPropertiesNodes.title
      ? makeTitle(getMetaTitleValue({ node: metaPropertiesNodes.title, filename }))
      : undefined;
    const metaTags = metaPropertiesNodes.tags
      ? getMetaTagsValue({ node: metaPropertiesNodes.tags, filename })
      : [];
    // TODO: Verify if we can remove it
    const metaId = metaPropertiesNodes.id
      ? getMetaIdValue({ node: metaPropertiesNodes.id, filename })
      : undefined;

    return storiesAttributesNodes.map((attributeNode) => {
      const { exportName, name } = getStoryIdentifiers({
        nameNode: attributeNode.name,
        exportNameNode: attributeNode.exportName,
        filename,
      });

      return {
        type: 'story',
        importPath: filename,
        exportName,
        name,
        title: metaTitle,
        tags: combineTags(
          ...metaTags,
          ...getTagsFromStoryAttribute({ node: attributeNode.tags, filename })
        ),
      } satisfies IndexInput;
    });
  },
};
