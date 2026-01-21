import { addons } from 'storybook/manager-api';

addons.register('redirect-fix', () => {
  const { pathname, search, hash } = window.location;

  if (pathname.endsWith('index.html')) {
    
    const newPathname = pathname.replace(/index\.html$/, '');
    const newUrl = newPathname + search + hash;

    window.location.replace(newUrl);
  }
});