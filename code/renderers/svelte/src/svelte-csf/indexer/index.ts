import fs from 'node:fs/promises';

import { combineTags } from '@storybook/csf';
import type { IndexInput, Indexer } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import { getSvelteAST } from '../parser/ast.js';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.js';
import { extractMetaPropertiesNodes } from '../parser/extract/meta-properties.js';
import { extractStoryAttributesNodes } from '../parser/extract/svelte/Story/attributes.js';
import {
  getMetaIdValue,
  getMetaTagsValue,
  getMetaTitleValue,
} from '../parser/analyse/meta/properties.js';
import { getTagsFromStoryAttribute } from '../parser/analyse/Story/attributes/tags.js';
import { getStoryIdentifiers } from '../parser/analyse/Story/attributes/identifiers.js';

export const indexer: Indexer = {
  test: /\.svelte$/,
  createIndex: async (filename, { makeTitle }) => {
    let [source, { loadSvelteConfig }] = await Promise.all([
      fs.readFile(filename, { encoding: 'utf8' }),
      import('@sveltejs/vite-plugin-svelte'),
    ]);

    const svelteConfig = await loadSvelteConfig();

    if (svelteConfig?.preprocess) {
      source = (
        await preprocess(source, svelteConfig.preprocess, {
          filename: filename,
        })
      ).code;
    }

    const svelteAST = getSvelteAST({ source, filename });
    const nodes = await extractSvelteASTNodes({ ast: svelteAST, filename });
    const metaPropertiesNodes = extractMetaPropertiesNodes({
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
