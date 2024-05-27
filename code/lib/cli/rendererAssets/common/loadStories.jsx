// src/stories/loadStories.js
export const loadStories = () => {
  const modules = import.meta.glob('./*.stories.ts');

  const loadModule = async (modulePath) => {
    const module = await modules[modulePath]();
    const meta = module.default;
    const stories = Object.entries(module).filter(
      ([key]) => key !== 'default' && key !== '__namedExportsOrder'
    );
    return { meta, stories };
  };

  return Promise.all(Object.keys(modules).map(loadModule));
};
