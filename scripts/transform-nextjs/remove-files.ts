import * as fs from 'fs';

export function removeFiles(docsDir) {
  const filePath1 = `${docsDir}/frameworks.js`;
  if (fs.existsSync(filePath1)) fs.unlinkSync(filePath1);

  const filePath2 = `${docsDir}/toc.js`;
  if (fs.existsSync(filePath2)) fs.unlinkSync(filePath2);

  const folder1 = `${docsDir}/versions`;
  if (fs.existsSync(folder1))
    fs.rm(folder1, { recursive: true, force: true }, (error) => {
      if (error) console.log(error);
    });

  const folder2 = `${docsDir}/snippets`;
  if (fs.existsSync(folder2))
    fs.rm(folder2, { recursive: true, force: true }, (error) => {
      if (error) console.log(error);
    });

  const folder3 = `${docsDir}/assets`;
  if (fs.existsSync(folder3))
    fs.rm(folder3, { recursive: true, force: true }, (error) => {
      if (error) console.log(error);
    });
}
