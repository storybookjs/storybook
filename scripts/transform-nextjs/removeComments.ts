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

              // This will convert all comments to MDX comments
              const newData = data.replace(/<!--(.*?)-->/gs, '{/*$1*/}');

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
