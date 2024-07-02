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
      /**
       * - example-name.js.mdx
       * - example-name.npm.js.mdx
       * - example-name.tab-title.js.mdx (storybook-run-dev.with-builder.js.mdx)
       * - example-name.tab-title.mdx
       */

      const segments = file.split('.');
      const localSegments = [...segments];
      localSegments.pop(); // Remove the last element (the file extension)
      localSegments.shift(); // Remove the first element (the filename)

      const tabTitle = null;

      // Find the index for a language in the array
      const languageIndex = localSegments.findIndex((segment) => {
        return ['js', 'ts', 'ts-4-9', 'mdx', 'json'].includes(segment);
      });

      // Language
      // If no language is found, default to 'ts'
      const language = localSegments[languageIndex] || 'ts';

      // Find the index for a language in the array
      const packageManagerIndex = localSegments.findIndex((segment) => {
        return ['npm', 'yarn', 'pnpm', 'npx'].includes(segment);
      });

      const packageManager = localSegments[packageManagerIndex] || null;

      // Remove language and package manager from the segments
      const newSegment = [...localSegments];
      if (languageIndex !== -1) newSegment.splice(languageIndex, 1);
      if (packageManagerIndex !== -1) newSegment.splice(packageManagerIndex, 1);

      const content = fs.readFileSync(`${oldSnippetsDir}/${dir}/${file}`, 'utf8');

      // take first line of content
      const firstLine = content.split('\n')[0];
      const secondLine = content.split('\n')[1];
      const codeFilename = secondLine.startsWith('// ') ? secondLine.slice(3) : null;

      // TODO: Check what we need to do when there's more than one tab
      const newFirstLine = `${firstLine}${
        codeFilename ? ` filename="${codeFilename}"` : ''
      } renderer="${dir}" language="${language}"${
        newSegment.length > 0 ? ` tabTitle="${newSegment.join('-')}"` : ''
      }${packageManager ? ` packageManager="${packageManager}"` : ''}`;

      // console.log(file);
      // console.log(segments);
      // console.log('Newline', newFirstLine);

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

    console.log(group);

    // Write the combined content to a new file
    fs.writeFileSync(`${newSnippetsDir}/${group}.md`, content, 'utf8');
  }
};
