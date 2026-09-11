import { compileCsfModule } from './lib/compiler/index.ts';

export default (content: string) => {
  try {
    const after = compileCsfModule(JSON.parse(content));
    return after;
  } catch (e) {
    // for debugging
    console.log(content, e);
  }
  return content;
};
