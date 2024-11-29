```js filename="pages/profile.js|jsx" renderer="react" language="js"
import React from 'react';

import ProfilePageContext from './ProfilePageContext';
import { ProfilePageContainer } from './ProfilePageContainer';
import { UserPostsContainer } from './UserPostsContainer';
import { UserFriendsContainer } from './UserFriendsContainer';

//👇 Ensure that your context value remains referentially equal between each render.
const context = {
  UserPostsContainer,
  UserFriendsContainer,
};

export const AppProfilePage = () => {
  return (
    <ProfilePageContext.Provider value={context}>
      <ProfilePageContainer />
    </ProfilePageContext.Provider>
  );
};
```

```js filename="pages/profile.js|jsx" renderer="solid" language="js"
import ProfilePageContext from './ProfilePageContext';
import { ProfilePageContainer } from './ProfilePageContainer';
import { UserPostsContainer } from './UserPostsContainer';
import { UserFriendsContainer } from './UserFriendsContainer';

//👇 Ensure that your context value remains referentially equal between each render.
const context = {
  UserPostsContainer,
  UserFriendsContainer,
};

export const AppProfilePage = () => {
  return (
    <ProfilePageContext.Provider value={context}>
      <ProfilePageContainer />
    </ProfilePageContext.Provider>
  );
};
```
