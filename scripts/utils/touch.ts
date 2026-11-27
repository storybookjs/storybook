export default function touch(filePath: string) {
  if (process.platform === 'win32') {
    return `echo. > ${filePath}`;
  }
  return `touch ${filePath}`;
}
