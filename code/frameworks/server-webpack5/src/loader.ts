import { compileCsfModule } from './lib/compiler/index.ts';

export default (content: string) => {
  try {
    return compileCsfModule(JSON.parse(content));
  } catch (e) {
    console.log(content, e);
  }
  return content;
};
