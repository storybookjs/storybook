```js filename="ProfilePage.stories.js|jsx" renderer="react" language="js"
import React from 'react';

import { ProfilePage } from './ProfilePage';
import { UserPosts } from './UserPosts';

//👇 Imports a specific story from a story file
import { Normal as UserFriendsNormal } from './UserFriends.stories';

export default {
  component: ProfilePage,
};

const ProfilePageProps = {
  name: 'Jimi Hendrix',
  userId: '1',
};

const context = {
  //👇 We can access the `userId` prop here if required:
  UserPostsContainer({ userId }) {
    return <UserPosts {...UserPostsProps} />;
  },
  // Most of the time we can simply pass in a story.
  // In this case we're passing in the `normal` story export
  // from the `UserFriends` component stories.
  UserFriendsContainer: UserFriendsNormal,
};

export const Normal = {
  render: () => (
    <ProfilePageContext.Provider value={context}>
      <ProfilePage {...ProfilePageProps} />
    </ProfilePageContext.Provider>
  ),
};
```

```js filename="ProfilePage.stories.js|jsx" renderer="solid" language="js"
import { ProfilePage } from './ProfilePage';
import { UserPosts } from './UserPosts';

//👇 Imports a specific story from a story file
import { Normal as UserFriendsNormal } from './UserFriends.stories';

export default {
  component: ProfilePage,
};

const ProfilePageProps = {
  name: 'Jimi Hendrix',
  userId: '1',
};

const context = {
  //👇 We can access the `userId` prop here if required:
  UserPostsContainer({ userId }) {
    return <UserPosts {...UserPostsProps} />;
  },
  // Most of the time we can simply pass in a story.
  // In this case we're passing in the `normal` story export
  // from the `UserFriends` component stories.
  UserFriendsContainer: UserFriendsNormal,
};

export const Normal = {
  render: () => (
    <ProfilePageContext.Provider value={context}>
      <ProfilePage {...ProfilePageProps} />
    </ProfilePageContext.Provider>
  ),
};
```

