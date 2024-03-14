import * as fs from 'fs';
import * as path from 'path';

export function removecomments(directoryPath: string) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return console.error('Unable to scan directory: ' + err);
    }

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      fs.stat(filePath, (err1, stats) => {
        if (err1) {
          console.error('Unable to get file stats: ' + err1);
          return;
        }

        if (stats.isDirectory()) {
          removecomments(filePath);
        } else {
          if (path.extname(file) === '.mdx') {
            fs.readFile(filePath, 'utf8', (err2, data) => {
              if (err2) {
                console.error('Unable to read file: ' + err2);
                return;
              }

              const newData = data
                .replace(/\n<!-- prettier-ignore-start -->\n/g, '')
                .replace(/\n<!-- prettier-ignore-end -->\n/g, '')
                .replace(/\n<!-- Re-read this for accuracy -->\n/g, '')
                .replace(/\n<!-- TODO: Is this used\? Should it be documented\? -->\n/g, '')
                .replace(/<!--\n  We intentionally do not use markdown tables here[\s\S]*?-->/g, '')
                .replace(/\n<!-- Not Angular -->\n/g, '')
                .replace(/\n<!-- Angular only -->\n/g, '')
                .replace(
                  /\n<!-- Uncomment once frameworks that support custom templates are enabled to prevent misinformation about the example -->\n/g,
                  ''
                )
                .replace(/\n<!-- TODO: Update this notice -->\n/g, '')
                .replace(/\n<!--This redirects to the \*\*Canvas\*\* tab of the story: -->\n/g, '')
                .replace(/\n<!-- TODO: Update this notice -->\n/g, '')
                .replace(
                  /\n<!--You can also use anchors to target a specific section of a page: -->\n/g,
                  ''
                );

              fs.writeFile(filePath, newData, 'utf8', (err3) => {
                if (err3) throw err3;
              });
            });
          }
        }
      });
    });
  });
}
