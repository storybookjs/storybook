import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractStories } from '../../parser/extract-stories.js';

const parser = fileURLToPath(new URL('../parser/collect-stories.js', import.meta.url)).replace(
  /\\/g,
  '/'
); // For Windows paths;

function transformSvelteStories(code: string) {
  // @ts-ignore eslint-disable-next-line no-underscore-dangle
  const { resource } = this._module;

  const componentName = getNameFromFilename(resource);

  const source = readFileSync(resource).toString();

  const storiesDef = extractStories(source);
  const { stories } = storiesDef;

  // const storyDef = Object.entries(stories)
  // 	.filter(([, def]) => !def?.template)
  // 	.map(
  // 		([id]) =>
  // 			`export const ${id} = __storiesMetaData.stories[${JSON.stringify(id)}]`,
  // 	)
  // 	.join("\n");

  // const metaExported = code.includes("export { meta }");
  // const codeWithoutDefaultExport = code
  // 	.replace("export default ", "//export default")
  // 	.replace("export { meta };", "// export { meta };");
  //
  // return `${codeWithoutDefaultExport}
  //    const { default: parser } = require('${parser}');
  //    const __storiesMetaData = parser(${componentName}, ${JSON.stringify(
  // 		storiesDef,
  // 	)}${metaExported ? ", meta" : ""});
  //    export default __storiesMetaData.meta;
  //    ${storyDef};
  //  ` as string;
}

export default transformSvelteStories;
