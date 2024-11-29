```js filename="ProfilePage.js|jsx" renderer="react" language="js"
import { useContext } from 'react';

import ProfilePageContext from './ProfilePageContext';

export const ProfilePage = ({ name, userId }) => {
  const { UserPostsContainer, UserFriendsContainer } = useContext(ProfilePageContext);

  return (
    <div>
      <h1>{name}</h1>
      <UserPostsContainer userId={userId} />
      <UserFriendsContainer userId={userId} />
    </div>
  );
};
```

```js filename="ProfilePage.js|jsx" renderer="solid" language="js"
import { useContext } from 'solid-js';

import ProfilePageContext from './ProfilePageContext';

export const ProfilePage = (props) => {
  const { UserPostsContainer, UserFriendsContainer } = useContext(ProfilePageContext);

  return (
    <div>
      <h1>{props.name}</h1>
      <UserPostsContainer userId={props.userId} />
      <UserFriendsContainer userId={props.userId} />
    </div>
  );
};
```
