import * as fs from 'fs';
import * as path from 'path';

export function countMarkdownFiles(dir: string) {
  let count = 0;
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      count += countMarkdownFiles(filePath); // Recurse if directory
    } else if (path.extname(file) === '.md') {
      count++;
    }
  });

  return count;
}

export function countAssetsFiles(dir: string) {
  let count = 0;
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      count += countMarkdownFiles(filePath); // Recurse if directory
    } else if (
      path.extname(file) === '.jpg' ||
      path.extname(file) === '.png' ||
      path.extname(file) === '.gif' ||
      path.extname(file) === '.webp' ||
      path.extname(file) === '.mp4'
    ) {
      count++;
    }
  });

  return count;
}
