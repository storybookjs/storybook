import { readFile } from 'node:fs/promises';

import { recast } from 'storybook/internal/babel';
import { loadCsf } from 'storybook/internal/csf-tools';
import { extractDescription } from 'storybook/internal/csf-tools';
import { type ComponentManifestGenerator } from 'storybook/internal/types';
import { type ComponentManifest } from 'storybook/internal/types';

import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj, getMatchingDocgen, parseWithReactDocgen } from './reactDocgen';
import { groupBy } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
}

export const componentManifestGenerator = async () => {
  return (async (storyIndexGenerator) => {
    const index = await storyIndexGenerator.getIndex();
    const groupByComponentId = groupBy(
      Object.values(index.entries)
        .filter((entry) => entry.type === 'story')
        .filter((entry) => entry.subtype === 'story' && entry.componentPath),
      (it) => it.id.split('--')[0]
    );
    const singleEntryPerComponent = Object.values(groupByComponentId).flatMap((group) =>
      group && group?.length > 0 ? [group[0]] : []
    );
    const components = await Promise.all(
      singleEntryPerComponent.flatMap(async (entry) => {
        const storyFile = await readFile(path.join(process.cwd(), entry.importPath), 'utf-8');
        const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();
        const componentName = csf._meta?.component;

        if (!componentName) {
          // TODO when there is not component name we could generate snippets based on the meta.render
          return;
        }

        const examples = Object.entries(csf._storyPaths)
          .map(([name, path]) => ({
            name,
            snippet: recast.print(getCodeSnippet(path, csf._metaNode ?? null, componentName)).code,
          }))
          .filter(Boolean);

        const id = entry.id.split('--')[0];

        const componentFile = await readFile(
          path.join(process.cwd(), entry.componentPath!),
          'utf-8'
        ).catch(() => {
          // TODO This happens too often. We should improve the componentPath resolution.
          return null;
        });

        if (!componentFile || !entry.componentPath) {
          return { id, name: componentName, examples, jsDocTags: {} };
        }

        const docgens = await parseWithReactDocgen({
          code: componentFile,
          filename: path.join(process.cwd(), entry.componentPath),
        });
        const docgen = getMatchingDocgen(docgens, csf);

        const metaDescription = extractDescription(csf._metaStatement);
        const jsdocComment = metaDescription || docgen?.description;
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};

        const manifestDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        return {
          id,
          name: componentName,
          description: manifestDescription?.trim(),
          summary: tags.summary?.[0],
          import: tags.import?.[0],
          reactDocgen: docgen,
          jsDocTags: tags,
          examples,
        } satisfies ReactComponentManifest;
      })
    );

    return {
      v: 0,
      components: Object.fromEntries(
        components
          .filter((component) => component != null)
          .map((component) => [component.id, component])
      ),
    };
  }) satisfies ComponentManifestGenerator;
};
