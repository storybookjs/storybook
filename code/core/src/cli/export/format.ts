import { DesignExportError } from 'storybook/internal/server-errors';

import { gte, valid } from 'semver';

export type ExportStory = {
  id: string;
  title: string;
  name: string;
};

export type CapturedStory = ExportStory & {
  html: string;
  width: number;
  height: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validatePreviewVersion(metadata: unknown): void {
  if (
    !isRecord(metadata) ||
    typeof metadata.storybookVersion !== 'string' ||
    !valid(metadata.storybookVersion) ||
    !gte(metadata.storybookVersion, '11.0.0-rc.1')
  ) {
    throw new DesignExportError({
      message:
        'Export requires a Storybook 11 preview (11.0.0-rc.1 or later) to disable play functions. Rebuild the target Storybook and serve its project.json.',
    });
  }
}

export function readStoryIndex(index: unknown): ExportStory[] {
  if (!isRecord(index) || index.v !== 5 || !isRecord(index.entries)) {
    throw new DesignExportError({
      message: 'Expected a Storybook v5 index.json with an entries object.',
    });
  }
  const stories: ExportStory[] = [];
  for (const [key, entry] of Object.entries(index.entries)) {
    if (!isRecord(entry) || !['story', 'docs'].includes(String(entry.type))) {
      throw new DesignExportError({ message: `Invalid Storybook index entry: ${key}` });
    }
    if (entry.type === 'docs') {
      continue;
    }
    const { id, title, name } = entry;
    if (
      typeof id !== 'string' ||
      !id ||
      id !== key ||
      typeof title !== 'string' ||
      !title ||
      typeof name !== 'string' ||
      !name
    ) {
      throw new DesignExportError({ message: `Invalid Storybook index story: ${key}` });
    }
    stories.push({ id, title, name });
  }
  if (!stories.length) {
    throw new DesignExportError({ message: 'The Storybook index contains no stories to export.' });
  }
  return stories;
}

const importGuide = `# Import this Storybook library into Claude Design

This ZIP contains one editable HTML artboard per story variant. canvas.json places
variants together by component on one canvas. storybook.json maps files to story IDs.
Keep the assets directory beside the artboard files when extracting the archive.

Attach this ZIP to a Claude chat with Design support. Ask Claude to create a new
Design artifact from every supplied artboard, preserving the DOM, text, styles,
assets, dimensions and canvas positions. Ask it to adapt canvas.json to its current
editor format and supply its own runtime. Then check each artboard and edit a text
element directly. No Claude runtime is included in this archive.
The offline HTML uses a restrictive Content Security Policy; the importer must
replace it with the editor's policy when adding the editor runtime.

This is a manual import workflow, not an upload API or a guaranteed native file
format. The editor may need to translate the canvas metadata. Review the imported
result before using it as a design starting point.

These are snapshots of initial rendered visual state at the export viewport.
Storybook play functions, application logic, event handlers, responsive rules,
hover states, component source, and synchronization back to Storybook are not
included. Text and DOM elements remain editable; canvas and media content, shadow
DOM, external SVG use references, and programmatically created fonts are rejected.
Export those stories with ordinary DOM equivalents instead. Export again to a new
ZIP to capture library changes; existing design edits are not merged.

Review story content and asset/font licenses before sharing the archive.
`;

export function buildDesignFiles(captures: CapturedStory[]): Record<string, string> {
  const sorted = [...captures].sort((a, b) => {
    for (const key of ['title', 'name', 'id'] as const) {
      if (a[key] !== b[key]) {
        return a[key] < b[key] ? -1 : 1;
      }
    }
    return 0;
  });
  const files: Record<string, string> = {};
  const artboards: {
    file: string;
    title: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  const stories: (ExportStory & {
    file: string;
  })[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let component = '';
  for (const [index, story] of sorted.entries()) {
    if (index && (component !== story.title || x + story.width > 6000)) {
      y += rowHeight + (component !== story.title ? 160 : 80);
      x = 0;
      rowHeight = 0;
    }
    const file = `story-${index + 1}.dc.html`;
    files[file] = story.html;
    artboards.push({
      file,
      title: `${story.title} / ${story.name}`,
      x,
      y,
      w: story.width,
      h: story.height,
    });
    stories.push({ id: story.id, title: story.title, name: story.name, file });
    x += story.width + 80;
    rowHeight = Math.max(rowHeight, story.height);
    component = story.title;
  }
  files['canvas.json'] = JSON.stringify(
    { artboards, annotations: {}, launch: { view: 'canvas' } },
    null,
    2
  );
  files['storybook.json'] = JSON.stringify({ version: 1, stories }, null, 2);
  files['README.md'] = importGuide;
  return files;
}
