import * as fs from 'fs';
import * as path from 'path';

export async function convertMdToMdx(directoryPath: string) {
  const files = fs.readdirSync(directoryPath);

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      convertMdToMdx(filePath);
    } else if (path.extname(file) === '.md') {
      const newPath = path.join(directoryPath, path.parse(file).name + '.mdx');
      fs.renameSync(filePath, newPath);
    }
  });
}
