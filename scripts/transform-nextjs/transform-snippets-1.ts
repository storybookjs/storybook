import * as fs from 'fs';

type Snippet = {
  path: string;
  segments: string[];
  filename: string;
  renderer: string;
  language: string;
  tabTitle: string | null;
  firstLine: string;
  secondLine: string;
  codeFilename: string | null;
  newFirstLine: string;
  content: string;
  newContent: string;
};

export const transformSnippets = async (oldSnippetsDir, newSnippetsDir) => {
  const root = fs.readdirSync(oldSnippetsDir);
  const snippets: Snippet[] = [];

  // Iterate over each folder in the snippets directory
  root.forEach((dir) => {
    const folder = fs.readdirSync(`${oldSnippetsDir}/${dir}`).map((file) => {
      const segments = file.split('.');
      segments.pop();

      let tabTitle = null;
      if (segments.length === 3) tabTitle = segments[1];
      if (tabTitle === '2') tabTitle = 'Vue 2';
      if (tabTitle === '3') tabTitle = 'Vue 3';

      let packageManager = null;
      if (tabTitle === 'npm') {
        packageManager = 'npm';
        tabTitle = null;
      }
      if (tabTitle === 'yarn') {
        packageManager = 'yarn';
        tabTitle = null;
      }
      if (tabTitle === 'pnpm') {
        packageManager = 'pnpm';
        tabTitle = null;
      }
      if (tabTitle === 'npx') {
        packageManager = 'npx';
        tabTitle = null;
      }

      const language = segments[segments.length - 1];

      const content = fs.readFileSync(`${oldSnippetsDir}/${dir}/${file}`, 'utf8');

      // take first line of content
      const firstLine = content.split('\n')[0];
      const secondLine = content.split('\n')[1];
      const codeFilename = secondLine.startsWith('// ') ? secondLine.slice(3) : null;
      const newFirstLine = `${firstLine}${
        codeFilename ? ` filename="${codeFilename}"` : ''
      } renderer="${dir}" language="${language}"${tabTitle ? ` tabTitle="${tabTitle}"` : ''}${
        packageManager ? ` packageManager="${packageManager}"` : ''
      }`;

      // Replace content first line by new first line
      const newContent = codeFilename
        ? content
            .replace(firstLine, newFirstLine)
            .replace(secondLine + '\n' + '\n', '')
            .replace(secondLine + '\n', '')
        : content.replace(firstLine, newFirstLine);

      return {
        path: file,
        segments,
        filename: segments[0],
        renderer: dir,
        language,
        tabTitle,
        firstLine,
        secondLine,
        codeFilename,
        newFirstLine,
        content,
        newContent,
      };
    });

    snippets.push(...folder);
  });

  // Group the snippets by filename
  const grouped = snippets.reduce<{ [key: string]: Snippet[] }>((acc, obj) => {
    const key = obj.filename;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(obj);
    return acc;
  }, {});

  // Create a new directory for the snippets
  if (!fs.existsSync(newSnippetsDir)) {
    fs.mkdirSync(newSnippetsDir, { recursive: true });
  }

  // Create a new file for each group
  for (const group in grouped) {
    let content = '';

    // Iterate over each snippet in the group
    grouped[group].forEach((snippet) => {
      content += snippet.newContent + '\n';
    });

    // Write the combined content to a new file
    fs.writeFileSync(`${newSnippetsDir}/${group}.md`, content, 'utf8');
  }
};
