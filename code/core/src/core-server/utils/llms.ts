import { writeFile } from 'node:fs/promises';

import type { Polka } from 'polka';

import { toStartCaseStr } from '../../csf/toStartCaseStr';
import type { LlmsLink, LlmsOptions, LlmsSection, StoryIndex } from '../../types';

const formatLlmsLink = ({ title, description, href }: LlmsLink) =>
  [title && href && `- [${title}](${href})`, description].filter(Boolean).join(' ');

const formatLlmsSection = ({ title, links }: LlmsSection) =>
  [title && `## ${title}`, '', ...(links ? links.map(formatLlmsLink) : [])].join('\n').trim();

const formatLlmsOptions = ({ title, description, details, sections }: LlmsOptions) =>
  [
    title && `# ${title}`,
    description && `> ${description}`,
    details,
    ...(sections ? sections.map(formatLlmsSection) : []),
  ]
    .filter(Boolean)
    .join('\n\n');

export const createDocsSections = (indexJson?: StoryIndex) => {
  const sections = Object.values(indexJson?.entries ?? {}).reduce(
    (acc, { type, title, name, id }) => {
      if (type === 'docs') {
        const parts = title.split('/');
        const href = `?path=/${type}/${id}`;
        const sectionTitle = parts.length > 1 ? toStartCaseStr(parts[0]) : 'Docs';
        const section = (acc[sectionTitle] = acc[sectionTitle] ?? {
          title: sectionTitle,
          links: [],
        });
        section.links!.push({ title: `${title} ${name}`.trim(), href });
      }
      return acc;
    },
    {} as Record<string, LlmsSection>
  );
  return Object.values(sections);
};

export const formatLlmsTxt = async (options: LlmsOptions | string, indexJson?: StoryIndex) => {
  if (typeof options === 'string') {
    return options;
  }

  const docsSections = options.includeDocs && indexJson ? createDocsSections(indexJson) : [];
  return formatLlmsOptions({
    ...options,
    sections: [...(options.sections ?? []), ...docsSections],
  });
};

export async function extractLlmsTxt(
  outputFile: string,
  options: LlmsOptions | string,
  indexJson?: StoryIndex
) {
  const llmsTxt = await formatLlmsTxt(options, indexJson);

  await writeFile(outputFile, llmsTxt);
}

export function useLlmsTxt(app: Polka, options: LlmsOptions | string, indexJson?: StoryIndex) {
  app.use('/llms.txt', async (req, res) => {
    const llmsTxt = await formatLlmsTxt(options, indexJson);
    res.setHeader('Content-Type', 'text/markdown');
    res.write(llmsTxt);
    res.end();
  });
}
