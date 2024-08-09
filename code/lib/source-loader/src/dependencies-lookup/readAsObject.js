import { sanitizeSource } from '../abstract-syntax-tree/generate-helpers';
import injectDecorator from '../abstract-syntax-tree/inject-decorator';

function readAsObject(classLoader, inputSource, mainFile) {
  const options = classLoader.getOptions();
  const result = injectDecorator(
    inputSource,
    classLoader.resourcePath,
    {
      ...options,
      parser: options.parser || classLoader.extension,
    },
    classLoader.emitWarning.bind(classLoader)
  );

  const sourceJson = sanitizeSource(result.storySource || inputSource);
  const addsMap = result.addsMap || {};
  const source = mainFile ? result.source : inputSource;

  return new Promise((resolve) =>
    resolve({
      source,
      sourceJson,
      addsMap,
    })
  );
}

export function readStory(classLoader, inputSource) {
  return readAsObject(classLoader, inputSource, true);
}
